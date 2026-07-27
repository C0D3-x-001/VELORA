import { useState, useEffect } from "react";
import { cn } from "../../../lib/utils";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

const icons = { success: CheckCircle, error: AlertCircle, warning: AlertTriangle, info: Info };
const colors = {
  success: "bg-success/10 border-success/30 text-success",
  error: "bg-danger/10 border-danger/30 text-danger",
  warning: "bg-warning/10 border-warning/30 text-warning",
  info: "bg-primary/10 border-primary/30 text-primary",
};

let toastId = 0;
const listeners = [];
const toasts = [];

export function toast({ title, description, type = "info", duration = 5000 }) {
  const id = ++toastId;
  const newToast = { id, title, description, type, duration };
  toasts.push(newToast);
  listeners.forEach((l) => l([...toasts]));
  if (duration) setTimeout(() => dismiss(id), duration);
  return id;
}

export function dismiss(id) {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx > -1) { toasts.splice(idx, 1); listeners.forEach((l) => l([...toasts])); }
}

function subscribe(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }

export function ToastContainer() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribe(setItems), []);
  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[100] flex flex-col gap-3 w-[calc(100vw-2rem)] max-w-80 md:max-w-96 animate-fade-in">
      {items.map((t) => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={cn(
              "flex items-start gap-3 p-4 rounded-xl border shadow-card-glass-hover animate-scale-in glass-strong",
              colors[t.type]
            )}>
              <div className="flex-shrink-0 w-5 h-5 mt-0.5"><Icon className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-body-sm text-text">{t.title}</p>
                {t.description && <p className="text-body-xs text-text-secondary mt-0.5">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="h-6 w-6 flex items-center justify-center rounded-lg text-text-secondary hover:text-text hover:bg-white/5 transition-colors" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
    </div>
  );
}

export function useToast() { return { toast, dismiss }; }