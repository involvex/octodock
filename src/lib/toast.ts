export type ToastVariant = "info" | "error";

export interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
}

type Listener = (toast: ToastMessage) => void;

let nextId = 1;
const listeners = new Set<Listener>();

/** Push a transient toast notification, shown by `ToastHost`. */
export function toast(text: string, variant: ToastVariant = "info"): void {
  const message: ToastMessage = { id: nextId++, text, variant };
  for (const listener of listeners) listener(message);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
