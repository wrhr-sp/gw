import React, { type ReactNode } from "react";

type PageShellProps = {
  backHref?: string | null;
  backLabel?: string;
  titleHref?: string | null;
  onTitleClick?: () => void;
  eyebrow?: string;
  title: string;
  titlePlacement?: "header" | "content";
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function PageShell({
  eyebrow,
  title,
  titlePlacement = "header",
  titleHref,
  onTitleClick,
  description: _description,
  children,
  actions,
  backHref = "/home",
}: PageShellProps) {
  const resolvedTitleHref = titleHref === undefined ? backHref : titleHref;

  return (
    <main className={titlePlacement === "content" ? "page-shell page-shell--title-in-content" : "page-shell"}>
      {titlePlacement === "header" ? (
        <div className="page-shell__header">
          {eyebrow ? <p className="page-shell__eyebrow">{eyebrow}</p> : null}
          <div className="page-shell__headline">
            <div>
              <h1>
                {onTitleClick ? (
                  <button className="page-shell__title-link page-shell__title-button" onClick={onTitleClick} type="button">{title}</button>
                ) : resolvedTitleHref ? (
                  <a className="page-shell__title-link" href={resolvedTitleHref}>{title}</a>
                ) : (
                  title
                )}
              </h1>
            </div>
            {actions ? <div className="page-shell__actions">{actions}</div> : null}
          </div>
        </div>
      ) : null}
      <div className="page-shell__content">{children}</div>
    </main>
  );
}

export function SurfaceSection({
  title,
  description: _description,
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
      </div>
      {children}
    </section>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "warning" }) {
  const className = tone === "accent" ? "pill pill--accent" : tone === "warning" ? "pill pill--warning" : "pill";
  return <span className={className}>{children}</span>;
}
