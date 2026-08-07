import { EventEmitter } from "node:events";

/**
 * Critical incident stream — Server-Sent Events (SSE) for real-time
 * critical incident notifications to connected clients.
 *
 * ARCHITECTURE NOTE (§15.2 / P1-11):
 * This uses an in-process EventEmitter, which means SSE notifications
 * only work within a single server instance. For horizontal scaling,
 * replace this with a durable pub/sub layer (e.g., Redis Pub/Sub).
 *
 * The transactional outbox (outboxService.ts) handles all durable
 * side effects (notifications, AI triage, PDF generation) and is
 * not affected by this limitation. This EventEmitter is solely for
 * the real-time SSE push to connected dashboard clients.
 *
 * Accepted single-instance limitation for the demo deployment.
 */

export type CriticalIncidentEvent = {
  incidentId: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
};

type Listener = (event: CriticalIncidentEvent) => void;

const CHANNEL = "critical-incident";
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function publishCriticalIncident(event: CriticalIncidentEvent): void {
  // Wrap in try-catch so a throwing listener doesn't crash the caller
  // (e.g., a report-service handler that pushes to an SSE stream).
  try {
    emitter.emit(CHANNEL, event);
  } catch (err) {
    console.error("[criticalIncidentStream] Listener error during publish:", err);
  }
}

export function subscribeToCriticalIncidents(listener: Listener): () => void {
  // Wrap the listener so errors in one listener don't propagate to the
  // publishCriticalIncident caller or prevent other listeners from firing.
  const wrapped = (event: CriticalIncidentEvent) => {
    try {
      listener(event);
    } catch (err) {
      console.error("[criticalIncidentStream] Listener error:", err);
    }
  };
  emitter.on(CHANNEL, wrapped);
  return () => {
    emitter.off(CHANNEL, wrapped);
  };
}
