/**
 * ErrorBoundary — catches unhandled render errors and shows a graceful
 * fallback instead of a blank page.
 *
 * Per refinement plan §14.4: "Do not blank a page because one subrequest failed."
 * This catches React render errors (not async fetch errors) and provides
 * a recovery path.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback render. Defaults to the standard error UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Unhandled render error:", error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center"
          role="alert"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-ink">Something went wrong</p>
          <p className="mt-1 text-sm text-slate-500 max-w-md">
            An unexpected error occurred while rendering this page. You can try again
            or navigate to a different section.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={this.reset}
              className="rounded-lg bg-tide px-4 py-2 text-sm font-semibold text-white hover:bg-tide/90 transition"
            >
              Try Again
            </button>
            <a
              href="/operations"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Go to Operations
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
