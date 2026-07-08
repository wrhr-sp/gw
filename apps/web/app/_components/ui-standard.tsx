import React, { type ReactNode } from "react";
import { buttonRules, statusColorTokens, type ButtonIntent, type StatusTone } from "../../design-system";

export function PageHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-shell__header ui-page-header">
      {eyebrow ? <p className="page-shell__eyebrow">{eyebrow}</p> : null}
      <div className="page-shell__headline">
        <h1>{title}</h1>
        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function FilterBar({ children, label = "검색 필터" }: { children: ReactNode; label?: string }) {
  return <section className="ui-filter-bar" aria-label={label}>{children}</section>;
}

export function DataTable({ children, label }: { children: ReactNode; label: string }) {
  return <div className="ui-data-table" aria-label={label}>{children}</div>;
}

export function StatusBadge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className={statusColorTokens[tone].className}>{children}</span>;
}

export function ConfirmDialog({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <section className="ui-confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2>
      <div>{children}</div>
      <ActionButtonGroup>{actions}</ActionButtonGroup>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <aside className="feature-workspace__empty-state ui-empty-state" aria-label={title}>
      <strong>{title}</strong>
      {children ? <div>{children}</div> : null}
    </aside>
  );
}

export function SummaryCard({ title, value, tone = "neutral" }: { title: string; value: ReactNode; tone?: StatusTone }) {
  return (
    <article className={`feature-workspace__status ui-summary-card ${statusColorTokens[tone].className}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card ui-detail-section">
      <div className="surface-card__header"><h2>{title}</h2></div>
      {children}
    </section>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card ui-form-section">
      <div className="surface-card__header"><h2>{title}</h2></div>
      <div className="feature-workspace__form">{children}</div>
    </section>
  );
}

export function ActionButtonGroup({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="ui-action-button-group feature-workspace__actions" aria-label={label}>{children}</div>;
}

export function StandardButton({ intent = "secondary", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { intent?: ButtonIntent }) {
  return <button {...props} className={[buttonRules[intent].className, props.className].filter(Boolean).join(" ")}>{children}</button>;
}

export function AttachmentPanel({ children }: { children: ReactNode }) {
  return <DetailSection title="첨부파일">{children}</DetailSection>;
}

export function AuditLogPanel({ children }: { children: ReactNode }) {
  return <DetailSection title="감사로그">{children}</DetailSection>;
}

export function ApprovalLinePanel({ children }: { children: ReactNode }) {
  return <DetailSection title="결재선">{children}</DetailSection>;
}
