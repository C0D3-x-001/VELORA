import { cn } from "../../../lib/utils";

export default function Card({ className, children, hover, glass, ...props }) {
  return (
    <div
      className={cn(
        glass ? "glass-card" : "card-base",
        hover && "card-hover",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}