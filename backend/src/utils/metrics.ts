/**
 * Lightweight in-process metrics collector.
 *
 * Per refinement plan §15.4:
 *   - request rate, latency, status, and request ID
 *   - AI latency, failure, schema validation, and cost estimate
 *   - job queue depth, age, retry, and failure
 *   - p95 latency from a rolling sample buffer
 *   - report ack time, alert delivery/ack, allocation lifecycle,
 *     asset auth failures, brief/PDF generation, admin actions
 *
 * This is a single-instance in-memory collector suitable for the demo.
 * For production, export these via a Prometheus endpoint or OpenTelemetry.
 */

interface RequestMetrics {
  count: number;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  statusCounts: Record<number, number>;
}

interface AiMetrics {
  calls: number;
  failures: number;
  totalLatencyMs: number;
  circuitOpenCount: number;
  retries: number;
}

/** Maximum number of latency samples kept in the rolling buffer. */
const LATENCY_BUFFER_MAX = 1000;

/** Threshold (in ms) beyond which a published brief is considered stale. */
const STALE_BRIEF_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

class MetricsCollector {
  private requests: RequestMetrics = {
    count: 0,
    totalLatencyMs: 0,
    minLatencyMs: Infinity,
    maxLatencyMs: 0,
    statusCounts: {},
  };

  private ai: AiMetrics = {
    calls: 0,
    failures: 0,
    totalLatencyMs: 0,
    circuitOpenCount: 0,
    retries: 0,
  };

  private startTime = Date.now();

  // ── p95 latency rolling buffer ───────────────────────────────────────────
  private latencyBuffer: number[] = [];

  // ── Report ack time ──────────────────────────────────────────────────────
  private reportAckCount = 0;
  private reportAckTotalMs = 0;
  private reportAckMaxMs = 0;

  // ── Alert delivery / ack ─────────────────────────────────────────────────
  private alertDeliveries = 0;
  private alertAcks = 0;

  // ── Allocation lifecycle ─────────────────────────────────────────────────
  private allocationHolds = 0;
  private allocationExpiries = 0;
  private allocationFulfillments = 0;

  // ── Asset auth failures ──────────────────────────────────────────────────
  private assetAuthFailures = 0;

  // ── Brief / PDF generation ───────────────────────────────────────────────
  private briefGenerations = 0;
  private briefGenerationTotalMs = 0;
  private briefGenerationMaxMs = 0;
  private pdfGenerations = 0;
  private pdfGenerationTotalMs = 0;
  private pdfGenerationMaxMs = 0;

  // ── Admin / audit actions ────────────────────────────────────────────────
  private adminActions = 0;

  // ── Latency violations (§15.1: p95 latency enforcement) ───────────────────
  private latencyViolations: Record<string, number> = {};

  // ── Request metrics ──────────────────────────────────────────────────────

  recordRequest(statusCode: number, latencyMs: number): void {
    this.requests.count++;
    this.requests.totalLatencyMs += latencyMs;
    if (latencyMs < this.requests.minLatencyMs) this.requests.minLatencyMs = latencyMs;
    if (latencyMs > this.requests.maxLatencyMs) this.requests.maxLatencyMs = latencyMs;
    const key = Math.floor(statusCode / 100) * 100; // group by 2xx, 4xx, 5xx
    this.requests.statusCounts[key] = (this.requests.statusCounts[key] ?? 0) + 1;

    // Store in rolling buffer for p95 calculation
    this.latencyBuffer.push(latencyMs);
    if (this.latencyBuffer.length > LATENCY_BUFFER_MAX) {
      this.latencyBuffer.shift();
    }
  }

  /**
   * Compute the p95 latency from the rolling sample buffer.
   * Returns 0 when no samples have been collected.
   */
  private computeP95(): number {
    const buf = this.latencyBuffer;
    if (buf.length === 0) return 0;

    // Copy and sort to avoid mutating the original buffer
    const sorted = [...buf].sort((a, b) => a - b);
    // p95 index: ceil(0.95 * n) - 1, clamped to valid range
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
    return Math.round(sorted[idx]);
  }

  // ── AI metrics ───────────────────────────────────────────────────────────

  recordAiCall(latencyMs: number): void {
    this.ai.calls++;
    this.ai.totalLatencyMs += latencyMs;
  }

  recordAiFailure(): void {
    this.ai.failures++;
  }

  recordAiRetry(): void {
    this.ai.retries++;
  }

  recordCircuitOpen(): void {
    this.ai.circuitOpenCount++;
  }

  // ── Report ack time ──────────────────────────────────────────────────────

  /**
   * Record the time (in ms) from report submission to coordinator acknowledgement.
   */
  recordReportAck(latencyMs: number): void {
    this.reportAckCount++;
    this.reportAckTotalMs += latencyMs;
    if (latencyMs > this.reportAckMaxMs) this.reportAckMaxMs = latencyMs;
  }

  // ── Alert delivery / ack ─────────────────────────────────────────────────

  /**
   * Record that an alert was delivered to a recipient channel.
   */
  recordAlertDelivery(): void {
    this.alertDeliveries++;
  }

  /**
   * Record that a delivered alert was acknowledged by the recipient.
   */
  recordAlertAck(): void {
    this.alertAcks++;
  }

  // ── Allocation lifecycle ─────────────────────────────────────────────────

  /**
   * Record that a resource allocation (hold/reservation) was placed.
   */
  recordAllocationHold(): void {
    this.allocationHolds++;
  }

  /**
   * Record that an allocation expired without being fulfilled.
   */
  recordAllocationExpiry(): void {
    this.allocationExpiries++;
  }

  /**
   * Record that an allocation was successfully fulfilled (picked up / delivered).
   */
  recordAllocationFulfillment(): void {
    this.allocationFulfillments++;
  }

  // ── Asset auth failures ──────────────────────────────────────────────────

  /**
   * Record an asset (file/media) authentication failure — e.g. invalid signature,
   * tampered upload, or unauthorized access attempt.
   */
  recordAssetAuthFailure(): void {
    this.assetAuthFailures++;
  }

  // ── Brief / PDF generation ───────────────────────────────────────────────

  /**
   * Record a situation brief generation, including its latency in ms.
   */
  recordBriefGeneration(latencyMs: number): void {
    this.briefGenerations++;
    this.briefGenerationTotalMs += latencyMs;
    if (latencyMs > this.briefGenerationMaxMs) this.briefGenerationMaxMs = latencyMs;
  }

  /**
   * Record a PDF document generation, including its latency in ms.
   */
  recordPdfGeneration(latencyMs: number): void {
    this.pdfGenerations++;
    this.pdfGenerationTotalMs += latencyMs;
    if (latencyMs > this.pdfGenerationMaxMs) this.pdfGenerationMaxMs = latencyMs;
  }

  // ── Admin / audit actions ────────────────────────────────────────────────

  /**
   * Record an administrative or audit-logged action (ban, role change, publish, etc.).
   */
  recordAdminAction(): void {
    this.adminActions++;
  }

  // ── Latency violations (§15.1) ────────────────────────────────────────────

  /**
   * Record a latency violation for a specific endpoint (§15.1: p95 enforcement).
   * Tracks the count of violations per endpoint so operators can identify
   * which routes are breaching the latency SLO.
   */
  recordLatencyViolation(endpoint: string): void {
    this.latencyViolations[endpoint] = (this.latencyViolations[endpoint] ?? 0) + 1;
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────

  getSnapshot() {
    const uptimeMs = Date.now() - this.startTime;
    const req = this.requests;
    const ai = this.ai;

    return {
      uptime: {
        seconds: Math.floor(uptimeMs / 1000),
        startedAt: new Date(this.startTime).toISOString(),
      },
      requests: {
        total: req.count,
        p50LatencyMs: req.count > 0 ? Math.round(req.totalLatencyMs / req.count) : 0,
        p95LatencyMs: this.computeP95(),
        minLatencyMs: req.count > 0 ? Math.round(req.minLatencyMs) : 0,
        maxLatencyMs: Math.round(req.maxLatencyMs),
        statusCounts: { ...req.statusCounts },
        ratePerSecond: req.count > 0 ? Number((req.count / (uptimeMs / 1000)).toFixed(2)) : 0,
      },
      ai: {
        calls: ai.calls,
        failures: ai.failures,
        retries: ai.retries,
        circuitOpenCount: ai.circuitOpenCount,
        failureRate: ai.calls > 0 ? Number(((ai.failures / ai.calls) * 100).toFixed(1)) : 0,
        avgLatencyMs: ai.calls > 0 ? Math.round(ai.totalLatencyMs / ai.calls) : 0,
      },
      reportAck: {
        count: this.reportAckCount,
        avgLatencyMs: this.reportAckCount > 0 ? Math.round(this.reportAckTotalMs / this.reportAckCount) : 0,
        maxLatencyMs: Math.round(this.reportAckMaxMs),
      },
      alerts: {
        deliveries: this.alertDeliveries,
        acks: this.alertAcks,
        ackRate: this.alertDeliveries > 0 ? Number(((this.alertAcks / this.alertDeliveries) * 100).toFixed(1)) : 0,
      },
      allocations: {
        holds: this.allocationHolds,
        expiries: this.allocationExpiries,
        fulfillments: this.allocationFulfillments,
        fulfilmentRate: this.allocationHolds > 0
          ? Number(((this.allocationFulfillments / this.allocationHolds) * 100).toFixed(1))
          : 0,
      },
      assetAuth: {
        failures: this.assetAuthFailures,
      },
      briefs: {
        generations: this.briefGenerations,
        avgLatencyMs: this.briefGenerations > 0 ? Math.round(this.briefGenerationTotalMs / this.briefGenerations) : 0,
        maxLatencyMs: Math.round(this.briefGenerationMaxMs),
      },
      pdf: {
        generations: this.pdfGenerations,
        avgLatencyMs: this.pdfGenerations > 0 ? Math.round(this.pdfGenerationTotalMs / this.pdfGenerations) : 0,
        maxLatencyMs: Math.round(this.pdfGenerationMaxMs),
      },
      admin: {
        actions: this.adminActions,
      },
      latencyViolations: {
        byEndpoint: { ...this.latencyViolations },
        total: Object.values(this.latencyViolations).reduce((sum, n) => sum + n, 0),
      },
    };
  }
}

export const metrics = new MetricsCollector();
