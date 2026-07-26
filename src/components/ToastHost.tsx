import { useEffect, useState } from "react";
import { subscribeToasts, type ToastMessage } from "../lib/toast";

const AUTO_DISMISS_MS = 5000;

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-xs rounded-lg border px-3 py-2 text-xs shadow-lg ${
            t.variant === "error"
              ? "border-red-800 bg-red-950 text-red-200"
              : "border-gray-700 bg-gray-800 text-gray-100"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
