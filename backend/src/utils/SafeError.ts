/**
 * Error subclass whose message is safe to expose to API clients.
 *
 * Use this for expected, user-facing errors (validation failures, "not found",
 * "already exists", etc.). The central error handler will return the message
 * verbatim. For unexpected errors (database failures, internal bugs), throw a
 * plain `Error` instead — the handler will return a generic message.
 */
export class SafeError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "SafeError";
    this.statusCode = statusCode;
  }
}
