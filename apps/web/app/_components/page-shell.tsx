import React, { type ReactNode } from "react";

type PageShellProps = {
  backHref?: string | null;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  titleHref?: string | null;
  titleLinkLabel?: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function PageShell({
  backHref = "/dashboard",
  backLabel = "대시보드로",
  eyebrow,
  title,
  titleHref = null,
  titleLinkLabel,
  description,
  children,
  actions,
}: PageShellProps) {
  const computedTitleLinkLabel = titleLinkLabel ?? `${title} 초기 화면으로 이동`;

  return (
    <main className="page-shell">
      <div className="page-shell__header">
        {backHref ? (
          <a href={backHref ?? undefined} className="ghost-link">
            ← {backLabel}
          </a>
        ) : null}
        {eyebrow ? <p className="page-shell__eyebrow">{eyebrow}</p> : null}
        <div className="page-shell__headline">
          <div>
            <h1>
              {titleHref ? (
                <a href={titleHref} className="page-shell__title-link" aria-label={computedTitleLinkLabel}>
                  {title}
                </a>
              ) : (
                title
              )}
            </h1>
            <p>{description}</p>
          </div>
          {actions ? <div className="page-shell__actions">{actions}</div> : null}
        </div>
      </div>
      <div className="page-shell__content">{children}</div>
    </main>
  );
}

export function SurfaceSection({
  title,
  description,
  children,
  muted = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={muted ? "surface-card surface-card--muted" : "surface-card"}>
      <div className="surface-card__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "warning" }) {
  const className = tone === "accent" ? "pill pill--accent" : tone === "warning" ? "pill pill--warning" : "pill";
  return <span className={className}>{children}</span>;
}
