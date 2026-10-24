import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

type Tone = "info" | "success" | "error";

interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

type Notify = (message: string, tone?: Tone) => void;

const ToastContext = createContext<Notify>(() => {});

const icons = {
  info: <Info size={16} className="text-ink-2" />,
  success: <CircleCheck size={16} className="text-good" />,
  error: <CircleAlert size={16} className="text-bad" />,
};

let nextId = 1;

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback<Notify>((message, tone = "info") => {
    const id = nextId++;
    setToasts((current) => [...current.slice(-3), { id, tone, message }]);
    setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      tone === "error" ? 6000 : 3000,
    );
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-lg animate-rise-in"
            >
              {icons[toast.tone]}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
