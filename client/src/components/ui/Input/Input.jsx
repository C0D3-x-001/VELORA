import { forwardRef } from "react";
import { cn } from "../../../lib/utils";

const Input = forwardRef(({ className, type = "text", error, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "w-full h-10 px-4 bg-bg-elevated border border-border rounded-xl text-body-sm text-text placeholder:text-text-muted",
        "transition-all duration-200 ease-out",
        "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
        error && "border-danger focus:border-danger focus:ring-danger/20",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
export default Input;