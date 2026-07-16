import type { ReactNode } from "react";
import { cn } from "../cn";

type SummaryCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
};

export function SummaryCard({ label, value, hint, className }: SummaryCardProps) {
  return (
    <article className={cn("rounded-card border border-border bg-surface p-4", className)}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}
