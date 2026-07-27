import Spinner from "../Spinner/Spinner";
import { cn } from "../../../lib/utils";

export default function LoadingOverlay({ message, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/15 animate-pulse-ring" />
        <div className="relative w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center shadow-card">
          <Spinner size="md" />
        </div>
      </div>
      {message && (
        <p className="text-sm text-text-secondary animate-fade-slide-up">{message}</p>
      )}
    </div>
  );
}
