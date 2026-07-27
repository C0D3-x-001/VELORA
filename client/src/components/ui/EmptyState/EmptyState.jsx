import { cn } from "../../../lib/utils";
import Button from "../Button/Button";

export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = "default",
  children,
}) {
  const iconBg = {
    default: "bg-gradient-to-br from-primary/10 to-viral/10 text-primary border-primary/20",
    danger: "bg-danger-muted text-danger border-danger/30",
    warning: "bg-warning-muted text-warning border-warning/30",
    success: "bg-success-muted text-success border-success/30",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 sm:py-16 px-4 sm:px-6 animate-fade-slide-up", className)}>
      {illustration ? (
        <div className="mb-8">{illustration}</div>
      ) : icon ? (
        <div className={cn(
          "w-18 h-18 rounded-2xl flex items-center justify-center mb-6 shadow-card-glass border",
          iconBg[variant]
        )}>
          {icon}
        </div>
      ) : null}

      <h3 className="text-display-sm text-text mb-3">{title}</h3>
      <p className="text-body-md text-text-secondary max-w-sm mb-10 leading-relaxed">{description}</p>

      {children}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && <Button {...action} />}
          {secondaryAction && <Button variant="ghost" {...secondaryAction} />}
        </div>
      )}
    </div>
  );
}