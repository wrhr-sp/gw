import type { ReactNode } from "react";
import { cn } from "../cn";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  titleAccessory?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  titleAccessory,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-semibold text-accent-text">{eyebrow}</p> : null}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight text-text md:text-[28px]">{title}</h1>
          {titleAccessory}
        </div>
        {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
