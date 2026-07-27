import { cn } from "../../../lib/utils";

const variants = {
  default: "bg-surface-subtle text-text border border-border",
  primary: "bg-primary/15 text-primary border border-primary/30",
  accent: "bg-viral/15 text-viral border border-viral/30",
  success: "bg-success-muted text-success border border-success/30",
  warning: "bg-warning-muted text-warning border border-warning/30",
  danger: "bg-danger-muted text-danger border border-danger/30",
  viral: "bg-gradient-to-r from-primary/20 to-viral/20 text-primary font-bold border border-primary/30",
  highlight: "bg-accent/15 text-accent border border-accent/30",
  outline: "bg-transparent text-text-secondary border border-border hover:border-border-strong hover:bg-surface-subtle",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-subtle border border-transparent",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-body-xs",
  lg: "px-3 py-1.5 text-body-sm",
};

export default function Badge({ children, variant = "default", size = "md", className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg font-medium transition-all duration-200",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}