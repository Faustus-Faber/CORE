import { useEffect, useRef, type ReactNode } from "react";

interface AccessibleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "danger" | "confirm";
}

export function AccessibleDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "default",
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Store the element that had focus before opening
    previouslyFocused.current = document.activeElement as HTMLElement;

    // Focus the dialog container
    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable) {
        focusable.focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 0);

    // Trap focus within the dialog
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Restore focus to the element that had it before opening
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const variantStyles = {
    default: "border-teal",
    danger: "border-critical",
    confirm: "border-teal",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`bg-panel-white rounded-lg shadow-panel max-w-md w-full mx-4 p-6 border-t-4 ${variantStyles[variant]}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        tabIndex={-1}
      >
        <h2 id="dialog-title" className="text-lg font-semibold text-ink mb-2">
          {title}
        </h2>
        {description && (
          <p id="dialog-description" className="text-sm text-muted mb-4">
            {description}
          </p>
        )}
        <div className="mb-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 pt-4 border-t border-muted/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Convenience wrapper for confirmation dialogs replacing window.confirm() */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AccessibleDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      variant={variant === "danger" ? "danger" : "confirm"}
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-ink rounded-md hover:bg-canvas transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
              variant === "danger" ? "bg-critical hover:bg-critical/90" : "bg-teal hover:bg-teal/90"
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <></>
    </AccessibleDialog>
  );
}

/** Convenience wrapper for alert dialogs replacing window.alert() */
interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function AlertDialog({ open, title, message, onClose }: AlertDialogProps) {
  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-teal hover:bg-teal/90 rounded-md transition-colors"
        >
          OK
        </button>
      }
    >
      <></>
    </AccessibleDialog>
  );
}
