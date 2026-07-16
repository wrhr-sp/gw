import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <section aria-label="목록 필터" className="rounded-panel border border-border bg-surface p-4">
      {children}
    </section>
  );
}

export function DataTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-panel border border-border bg-surface">
      {children}
    </section>
  );
}

export function EmptyState({ action, description, title }: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-panel border border-dashed border-border bg-surface px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function Pagination({ currentPage, nextHref, previousHref, totalPages }: {
  currentPage: number;
  nextHref?: string | undefined;
  previousHref?: string | undefined;
  totalPages: number;
}) {
  const linkClass = "inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-text hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const disabledClass = "inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-muted opacity-50";
  return (
    <nav aria-label="페이지 이동" className="flex items-center justify-between border-t border-border px-4 py-3">
      {previousHref ? <a className={linkClass} href={previousHref}>이전</a> : <span aria-disabled="true" className={disabledClass}>이전</span>}
      <span className="text-sm text-muted">{currentPage} / {totalPages}</span>
      {nextHref ? <a className={linkClass} href={nextHref}>다음</a> : <span aria-disabled="true" className={disabledClass}>다음</span>}
    </nav>
  );
}
