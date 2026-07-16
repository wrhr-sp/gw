import type { ReactNode } from "react";
import { cn } from "../cn";

type ActionButtonGroupProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function ActionButtonGroup({ label, children, className }: ActionButtonGroupProps) {
  return (
    <div aria-label={label} className={cn("flex flex-wrap items-center justify-end gap-2", className)} role="group">
      {children}
    </div>
  );
}
