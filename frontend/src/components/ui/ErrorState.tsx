/**
 * ErrorState — reusable error display with retry button.
 *
 * Per refinement plan §14.4:
 *   - "Every async action has idle, pending, success, recoverable error,
 *      and terminal error states."
 *   - "Provide retry and offline/provider-down states."
 *   - "Do not blank a page because one subrequest failed."
 *
 * Usage:
 *   {error && <ErrorState message="Failed to load" onRetry={refetch} /> }
 */

interface ErrorStateProps {
  message: string;
  detail?: string;
  onRetry?: () => void;
  /** "recoverable" shows retry button; "terminal" does not */
  severity?: "recoverable" | "terminal";
  /** Compact mode for inline errors (not full-page) */
  compact?: boolean;
}

export function ErrorState({
  message,
  detail,
  onRetry,
  severity = "recoverable",
  compact = false,
}: ErrorStateProps) {
  const isRecoverable = severity === "recoverable" && onRetry;

  if (compact) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 p-3"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-sm font-medium text-red-700">{message}</p>
        {detail && <p className="text-xs text-red-600 mt-0.5">{detail}</p>}
        {isRecoverable && (
          <button
            onClick={onRetry}
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-ink">{message}</p>
      {detail && <p className="mt-1 text-sm text-slate-500 max-w-md">{detail}</p>}
      {isRecoverable ? (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-tide px-4 py-2 text-sm font-semibold text-white hover:bg-tide/90 transition"
        >
          Try Again
        </button>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          This error cannot be resolved by retrying. Please contact support if the problem persists.
        </p>
      )}
    </div>
  );
}
