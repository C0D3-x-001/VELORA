import { cn } from "../../../lib/utils";

const sizes = { xs: "w-3 h-3", sm: "w-4 h-4", md: "w-5 h-5", lg: "w-7 h-7", xl: "w-10 h-10" };
const strokeWidths = { xs: 2, sm: 2.5, md: 2.5, lg: 3, xl: 3.5 };

export default function Spinner({ className, size = "md", color = "primary", ...props }) {
  const strokeWidth = strokeWidths[size];
  const radius = 10;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      className={cn(sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      role="status"
      aria-label="Loading"
    >
      <circle
        className="text-border"
        cx="12"
        cy="12"
        r={radius}
        strokeWidth={strokeWidth}
      />
      <circle
        className={cn(
          "animate-spin-slow",
          color === "white" && "text-white",
          color === "success" && "text-success",
          color === "danger" && "text-danger",
          color === "warning" && "text-warning",
          color === "accent" && "text-viral",
          color === "primary" && "text-primary",
          !["white", "success", "danger", "warning", "primary", "accent"].includes(color) && "text-primary"
        )}
        cx="12"
        cy="12"
        r={radius}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.3}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}