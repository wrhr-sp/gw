import React, { type ReactNode } from "react";

type PageShellProps = {
  backHref?: string | null;
  backLabel?: string;
  titleHref?: string | null;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function PageShell({
  eyebrow,
  title,
  titleHref,
  description,
  children,
  actions,
  backHref = "/home",
}: PageShellProps) {
  const resolvedTitleHref = titleHref === undefined ? backHref : titleHref;

  return (
    <main className="page-shell">
      <div className="page-shell__header">
        {eyebrow ? <p className="page-shell__eyebrow">{eyebrow}</p> : null}
        <div className="page-shell__headline">
          <div>
            <h1>
              {resolvedTitleHref ? (
                <a className="page-shell__title-link" href={resolvedTitleHref}>{title}</a>
              ) : (
                title
              )}
            </h1>
            {description ? <p>{description}</p> : null}
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
