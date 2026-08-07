import type { NextFunction, Request, Response } from "express";

/**
 * Simple in-memory rate limiter.
 * Uses a sliding window per IP address. Suitable for single-instance deployment.
 * For production, consider Redis-based rate limiting.
 */
interface RateLimitStore {
  timestamps: number[];
}

const stores = new Map<string, RateLimitStore>();
const MAX_STORE_SIZE = 10_000; // Safety valve to prevent unbounded memory growth

// Cleanup old entries every 10 minutes.
// Use a generous max window (5 minutes) so we don't prematurely delete entries
// for any limiter. Entries with no recent timestamps are removed entirely.
const MAX_WINDOW_MS = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, store] of stores) {
    store.timestamps = store.timestamps.filter((ts) => now - ts < MAX_WINDOW_MS);
    if (store.timestamps.length === 0) {
      stores.delete(key);
    }
  }

  // Safety valve: if the store has grown too large (e.g. under DDoS), evict
  // the oldest entries to bound memory usage.
  if (stores.size > MAX_STORE_SIZE) {
    const toRemove = stores.size - MAX_STORE_SIZE;
    let removed = 0;
    for (const key of stores.keys()) {
      if (removed >= toRemove) break;
      stores.delete(key);
      removed++;
    }
  }
}, 10 * 60 * 1000);

// Allow graceful shutdown to clear the timer
export function cleanupRateLimiter() {
  clearInterval(cleanupTimer);
  stores.clear();
}

type RateLimitOptions = {
  windowMs: number;    // window size in milliseconds
  max: number;          // maximum requests per window
  message: string;      // error message
  skipRequests?: (req: Request) => boolean;  // Skip rate limiting for certain requests
};

export function createRateLimiter(options: RateLimitOptions) {
  // Include a unique limiter name in the key so different limiters don't share
  // the same timestamp array for the same IP. Without this, the auth limiter
  // (5/min) and the general limiter (100/min) would collide on the same key.
  const limiterKey = `rate_limit:${options.message.slice(0, 20)}:${options.windowMs}:${options.max}`;

  return (request: Request, response: Response, next: NextFunction) => {
    // Skip if middleware not applicable
    if (options.skipRequests?.(request)) {
      return next();
    }

    // Get client IP — Express populates request.ip from X-Forwarded-For
    // when `trust proxy` is configured (set in app.ts).
    const ip = request.ip ?? "unknown";

    const key = `${limiterKey}:${ip}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;

    let store = stores.get(key);
    if (!store) {
      store = { timestamps: [] };
      stores.set(key, store);
    }

    // Clean old timestamps
    store.timestamps = store.timestamps.filter((ts) => ts > windowStart);

    // Check limit
    if (store.timestamps.length >= options.max) {
      const retryAfter = Math.ceil((store.timestamps[0] + options.windowMs - now) / 1000);
      response.setHeader("Retry-After", String(retryAfter));
      return response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: options.message,
          retryAfter,
          retryable: true
        },
        requestId: request.headers["x-request-id"]
      });
    }

    // Record request
    store.timestamps.push(now);

    return next();
  };
}

// Pre-configured rate limiters

// Auth endpoints (login, register, reset) — 5 requests per minute
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many authentication attempts. Please wait a moment and try again."
});

// General API rate limiter — 100 requests per minute
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: "Too many requests. Please slow down."
});

// Signal submission — 10 requests per minute
export const signalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many report submissions. Please wait a moment."
});

// Upload endpoints — 20 requests per minute
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many file uploads. Please wait a moment."
});

// OCR/AI endpoints — 30 requests per minute
export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many AI/OCR requests. Please wait a moment."
});
