import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../cn";

const statusBadgeVariants = cva(
  "inline-flex min-h-6 items-center rounded-badge border px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        success: "border-green-200 bg-green-50 text-green-800",
        info: "border-blue-200 bg-blue-50 text-blue-800",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
        major: "border-orange-200 bg-orange-50 text-orange-900",
        danger: "border-red-200 bg-red-50 text-red-800",
        neutral: "border-border bg-background text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ children, tone = "neutral", className }: StatusBadgeProps) {
  const label = typeof children === "string" ? children : "업무 상태";
  return (
    <span
      aria-label={`상태: ${label}`}
      className={cn(statusBadgeVariants({ tone }), className)}
      data-tone={tone}
    >
      {children}
    </span>
  );
}
