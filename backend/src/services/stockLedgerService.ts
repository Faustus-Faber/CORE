import { prisma } from "../lib/prisma.js";
import type { StockEntryType } from "@prisma/client";

/**
 * P0-12: Atomic stock ledger for race-free inventory operations.
 * All stock changes go through this service to ensure atomicity.
 */

interface HoldResult {
  success: boolean;
  heldQuantity: number;
  availableQuantity: number;
  ledgerEntryId?: string;
  error?: string;
}

/**
 * Atomically hold stock for an allocation.
 * Uses a transaction with the stock ledger to prevent oversubscription.
 */
export async function holdStock(params: {
  resourceId: string;
  allocationId: string;
  quantity: number;
  actorId: string;
  idempotencyKey?: string;
}): Promise<HoldResult> {
  const { resourceId, allocationId, quantity, actorId, idempotencyKey } = params;

  // Check idempotency
  if (idempotencyKey) {
    const existing = await prisma.stockLedgerEntry.findFirst({
      where: { idempotencyKey },
    });
    if (existing) {
      const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
      return {
        success: true,
        heldQuantity: existing.quantity,
        availableQuantity: resource?.quantity ?? 0,
        ledgerEntryId: existing.id,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const resource = await tx.resource.findUnique({
        where: { id: resourceId },
      });

      if (!resource) {
        throw new Error("Resource not found");
      }

      // Calculate current held quantity from ledger
      const heldEntries = await tx.stockLedgerEntry.aggregate({
        where: {
          resourceId,
          entryType: "HOLD",
        },
        _sum: { quantity: true },
      });

      const releasedEntries = await tx.stockLedgerEntry.aggregate({
        where: {
          resourceId,
          entryType: "RELEASE",
        },
        _sum: { quantity: true },
      });

      const fulfilledEntries = await tx.stockLedgerEntry.aggregate({
        where: {
          resourceId,
          entryType: "FULFILL",
        },
        _sum: { quantity: true },
      });

      const heldTotal = (heldEntries._sum.quantity ?? 0) - (releasedEntries._sum.quantity ?? 0) - (fulfilledEntries._sum.quantity ?? 0);
      const available = resource.quantity - heldTotal;

      // Guard against data corruption — if heldTotal exceeds resource.quantity,
      // available goes negative and any quantity check would pass incorrectly.
      if (available < 0) {
        throw new Error(`Stock ledger data integrity error: available quantity is negative (${available}) for resource ${resourceId}. Please contact support.`);
      }

      if (quantity > available) {
        throw new Error(`Not enough available stock. Requested: ${quantity}, Available: ${available}`);
      }

      // Create the HOLD ledger entry
      const entry = await tx.stockLedgerEntry.create({
        data: {
          resourceId,
          entryType: "HOLD" as StockEntryType,
          quantity,
          allocationId,
          idempotencyKey,
          reason: `Hold for allocation ${allocationId}`,
          actorId,
        },
      });

      return { entry, available };
    });

    return {
      success: true,
      heldQuantity: quantity,
      availableQuantity: result.available,
      ledgerEntryId: result.entry.id,
    };
  } catch (error) {
    return {
      success: false,
      heldQuantity: 0,
      availableQuantity: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Release a hold (when allocation is cancelled or declined).
 */
export async function releaseStock(params: {
  resourceId: string;
  allocationId: string;
  actorId: string;
  reason?: string;
}): Promise<void> {
  // Find the original hold entry to get the quantity
  const holdEntry = await prisma.stockLedgerEntry.findFirst({
    where: { allocationId: params.allocationId, entryType: "HOLD" },
  });

  if (!holdEntry) return;

  // Idempotency: if a RELEASE entry already exists for this allocation,
  // do not create a duplicate (prevents double-release on client retry).
  const existingRelease = await prisma.stockLedgerEntry.findFirst({
    where: { allocationId: params.allocationId, entryType: "RELEASE" },
  });
  if (existingRelease) return;

  await prisma.stockLedgerEntry.create({
    data: {
      resourceId: params.resourceId,
      entryType: "RELEASE" as StockEntryType,
      quantity: holdEntry.quantity,
      allocationId: params.allocationId,
      reason: params.reason ?? `Release for allocation ${params.allocationId}`,
      actorId: params.actorId,
    },
  });
}

/**
 * Fulfill stock (when allocation is delivered).
 * This permanently removes stock from available count by decrementing
 * resource.quantity and recording a FULFILL ledger entry for audit.
 */
export async function fulfillStock(params: {
  resourceId: string;
  allocationId: string;
  quantity: number;
  actorId: string;
  idempotencyKey?: string;
}): Promise<void> {
  if (params.idempotencyKey) {
    const existing = await prisma.stockLedgerEntry.findFirst({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockLedgerEntry.create({
      data: {
        resourceId: params.resourceId,
        entryType: "FULFILL" as StockEntryType,
        quantity: params.quantity,
        allocationId: params.allocationId,
        idempotencyKey: params.idempotencyKey,
        reason: `Fulfill allocation ${params.allocationId}`,
        actorId: params.actorId,
      },
    });

    // Decrement resource.quantity so fulfilled stock is no longer available
    await tx.resource.update({
      where: { id: params.resourceId },
      data: { quantity: { decrement: params.quantity } },
    });
  });
}

/**
 * Increment stock (replenishment).
 */
export async function incrementStock(params: {
  resourceId: string;
  quantity: number;
  actorId: string;
  reason?: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.stockLedgerEntry.create({
      data: {
        resourceId: params.resourceId,
        entryType: "INCREMENT" as StockEntryType,
        quantity: params.quantity,
        reason: params.reason ?? "Replenishment",
        actorId: params.actorId,
      },
    });

    // Also update the resource quantity
    await tx.resource.update({
      where: { id: params.resourceId },
      data: { quantity: { increment: params.quantity } },
    });
  });
}

/**
 * Get the current available quantity for a resource based on the ledger.
 *
 * NOTE: resource.quantity already reflects INCREMENT and FULFILL adjustments
 * (those operations update resource.quantity directly), so we only need to
 * subtract active holds (HOLD - RELEASE - FULFILL) to get the available amount.
 * Adding INCREMENT/DECREMENT ledger totals here would double-count them.
 */
export async function getAvailableQuantity(resourceId: string): Promise<number> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { quantity: true },
  });

  if (!resource) return 0;

  const [held, released, fulfilled] = await Promise.all([
    prisma.stockLedgerEntry.aggregate({
      where: { resourceId, entryType: "HOLD" },
      _sum: { quantity: true },
    }),
    prisma.stockLedgerEntry.aggregate({
      where: { resourceId, entryType: "RELEASE" },
      _sum: { quantity: true },
    }),
    prisma.stockLedgerEntry.aggregate({
      where: { resourceId, entryType: "FULFILL" },
      _sum: { quantity: true },
    }),
  ]);

  const totalHeld = (held._sum.quantity ?? 0) - (released._sum.quantity ?? 0) - (fulfilled._sum.quantity ?? 0);
  return resource.quantity - totalHeld;
}
