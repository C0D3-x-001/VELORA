import { forwardRef, cloneElement, isValidElement } from "react";
import { cn } from "../../../lib/utils";
import Spinner from "../Spinner/Spinner";

const Button = forwardRef(({ className, variant = "primary", size = "md", loading, disabled, asChild, children, ...props }, ref) => {
  const base = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] select-none";

  const variants = {
    primary: "bg-primary text-white shadow-button hover:bg-primary-hover hover:shadow-button-hover focus-visible:ring-primary/50",
    secondary: "bg-surface-subtle text-text border border-border hover:bg-surface-overlay hover:border-border-strong focus-visible:ring-text/20",
    ghost: "text-text-secondary hover:bg-surface-subtle hover:text-text focus-visible:ring-text/10",
    danger: "bg-danger-muted text-danger border border-danger/25 hover:bg-danger/25 hover:border-danger/40 focus-visible:ring-danger/30",
    success: "bg-success-muted text-success border border-success/25 hover:bg-success/25 hover:border-success/40 focus-visible:ring-success/30",
    outline: "bg-transparent text-text border border-border hover:bg-surface-subtle hover:border-border-strong focus-visible:ring-text/10",
  };

  const sizes = {
    sm: "h-8 px-3 text-body-xs gap-1.5",
    md: "h-10 px-4 text-body-sm gap-2",
    lg: "h-12 px-6 text-body-md gap-2",
    xl: "h-14 px-8 text-body-lg gap-2.5",
    icon: "h-10 w-10 p-0",
  };

  const classes = cn(base, variants[variant], sizes[size], className);
  const mergedProps = { ...props, ref, className: classes, disabled: disabled || loading };

  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      ...mergedProps,
      ...children.props,
      className: cn(classes, children.props.className),
      children: (
        <>
          {loading && <Spinner size={size === "sm" || size === "icon" ? "sm" : "md"} />}
          {children.props.children}
        </>
      ),
    });
  }

  return (
    <button {...mergedProps}>
      {loading && <Spinner size={size === "sm" || size === "icon" ? "sm" : "md"} />}
      {children}
    </button>
  );
});
Button.displayName = "Button";
export default Button;