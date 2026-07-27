import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, title, children, className, size = "md" }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleEsc); document.body.style.overflow = ""; };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl", full: "max-w-[90vw]" };
  return createPortal(
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-surface/95 backdrop-blur-glass-strong border border-border/50 shadow-[0_32px_64px_-12px_rgb(0_0_0/0.5),0_0_0_1px_rgb(255_255_255/0.03)] animate-scale-in max-h-[90vh] overflow-y-auto",
          sizes[size],
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
            <h2 className="text-heading-md text-text">{title}</h2>
            <button onClick={onClose} className="h-8 w-8 rounded-xl bg-surface-subtle flex items-center justify-center text-text-secondary hover:text-text hover:bg-surface-overlay transition-colors" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}