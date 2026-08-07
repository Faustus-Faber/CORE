import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Clean up all pending timers on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      for (const id of Object.keys(timerRefs.current)) {
        clearTimeout(timerRefs.current[id]);
      }
    };
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, variant }].slice(-5));
    timerRefs.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timerRefs.current[id];
    }, 5000);
  }, []);

  const variantStyles: Record<ToastVariant, string> = {
    success: "bg-success text-white",
    error: "bg-critical text-white",
    info: "bg-teal text-white",
    warning: "bg-amber text-white",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${variantStyles[toast.variant]} px-4 py-3 rounded-lg shadow-panel text-sm font-medium max-w-sm`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback to console.warn if no provider — useToast was called outside ToastProvider
    return {
      showToast: (message: string, variant: ToastVariant = "info") => {
        console.warn(`[Toast ${variant}]: ${message} (no ToastProvider mounted)`);
      },
    };
  }
  return context;
}
