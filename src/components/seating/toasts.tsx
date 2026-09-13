import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type Toast = { id: number; kind: "success" | "error" | "info"; text: string };

/** Reading-time toast duration: ~220 wpm, floored so short messages don't flash. */
function toastDuration(text: string, kind: Toast["kind"]): number {
  const words = text.trim().split(/\s+/).length;
  const reading = Math.round((words / 220) * 60_000);
  const floor = kind === "error" ? 6000 : 4000;
  return Math.min(Math.max(reading, floor), 12_000);
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      toastDuration(toast.text, toast.kind),
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.text, toast.kind, onDismiss]);

  return (
    <div
      className={`sp-toast sp-toast--${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
    >
      <span className="sp-toast__text">{toast.text}</span>
      <Button
        variant="ghost"
        type="button"
        className="sp-iconbtn sp-iconbtn--tiny sp-toast__close"
        aria-label="Descartar aviso"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </Button>
    </div>
  );
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="sp-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current.slice(-3), { id, kind, text }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
