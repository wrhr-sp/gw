"use client";

import React, { useMemo, useState } from "react";

import { FeaturePageOverflowMenu } from "./feature-page-overflow-menu";

export type FeatureWorkspaceTab = {
  id: string;
  label: string;
  note?: string;
  badge?: string;
};

export type FeatureWorkspaceCard = {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "accent" | "warning";
};

export type FeatureWorkspaceAction = {
  label: string;
  tone?: "primary" | "secondary" | "danger";
  /**
   * FeatureWorkspace is a generic static workspace surface. A visible action must
   * either be wired by a feature-specific component/API flow, or be explicitly
   * disabled here so it is not mistaken for a completed mutation.
   */
  disabledReason?: string;
};

const DEFAULT_DISABLED_ACTION_REASON = "실제 API 연결 또는 승인 범위 확정이 필요한 기능입니다.";

export type FeatureWorkspaceRow = {
  title: string;
  meta: string;
  status: string;
  body?: string;
  actions?: readonly FeatureWorkspaceAction[];
};

export type FeatureWorkspacePanel = {
  id: string;
  heading: string;
  summary: string;
  statusCards?: readonly FeatureWorkspaceCard[];
  formFields?: readonly { label: string; value: string; type?: "text" | "date" | "select" | "textarea" }[];
  actions?: readonly FeatureWorkspaceAction[];
  rows?: readonly FeatureWorkspaceRow[];
  notes?: readonly string[];
  emptyState?: { title: string; body: string; actionLabel?: string };
  permissionHint?: string;
};

export type FeatureWorkspaceConfig = {
  title: string;
  eyebrow?: string;
  tabs: readonly FeatureWorkspaceTab[];
  panels: readonly FeatureWorkspacePanel[];
  utility?: readonly { label: string; value: string }[];
};

function renderField(field: { label: string; value: string; type?: "text" | "date" | "select" | "textarea" }) {
  if (field.type === "textarea") {
    return <textarea aria-label={field.label} defaultValue={field.value} rows={4} />;
  }

  if (field.type === "select") {
    return (
      <select aria-label={field.label} defaultValue={field.value}>
        <option>{field.value}</option>
      </select>
    );
  }

  return <input aria-label={field.label} defaultValue={field.value} type={field.type ?? "text"} />;
}

function renderDisabledActionButton(action: FeatureWorkspaceAction, className: string) {
  const disabledReason = action.disabledReason ?? DEFAULT_DISABLED_ACTION_REASON;

  return (
    <button
      aria-disabled="true"
      aria-label={`${action.label} — ${disabledReason}`}
      className={className}
      disabled
      title={disabledReason}
      type="button"
    >
      {action.label}
    </button>
  );
}

export function FeatureWorkspace({ config }: { config: FeatureWorkspaceConfig }) {
  const [activeId, setActiveId] = useState(config.tabs[0]?.id ?? config.panels[0]?.id ?? "");
  const activePanel = useMemo(
    () => config.panels.find((panel) => panel.id === activeId) ?? config.panels[0],
    [activeId, config.panels],
  );

  return (
    <div className="feature-workspace">
      <aside className="feature-workspace__nav" aria-label={`${config.title} 메뉴`}>
        <div className="feature-workspace__nav-header">
          <h1>
            <button className="page-shell__title-link page-shell__title-button" onClick={() => setActiveId(config.tabs[0]?.id ?? config.panels[0]?.id ?? "")} type="button">
              {config.title}
            </button>
          </h1>
          <FeaturePageOverflowMenu label={config.title} />
        </div>

        <div className="feature-workspace__tab-list" role="tablist" aria-label={`${config.title} 화면 선택`}>
          {config.tabs.map((tab) => (
            <button
              aria-selected={activeId === tab.id}
              className="feature-workspace__tab"
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              {tab.badge ? <strong>{tab.badge}</strong> : null}
              {tab.note ? <small>{tab.note}</small> : null}
            </button>
          ))}
        </div>

        {config.utility?.length ? (
          <div className="feature-workspace__utility" aria-label="요약 정보">
            {config.utility.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      <section className="feature-workspace__panel" aria-labelledby={`${activePanel.id}-heading`}>
        <div className="feature-workspace__panel-header">
          <div>
            <h2 id={`${activePanel.id}-heading`}>{activePanel.heading}</h2>
          </div>
          {activePanel.permissionHint ? <p className="feature-workspace__permission-hint">{activePanel.permissionHint}</p> : null}
        </div>

        {activePanel.statusCards?.length ? (
          <div className="feature-workspace__status-grid">
            {activePanel.statusCards.map((card) => (
              <article className={`feature-workspace__status feature-workspace__status--${card.tone ?? "default"}`} key={`${card.label}-${card.value}`}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                {card.note ? <p>{card.note}</p> : null}
              </article>
            ))}
          </div>
        ) : null}

        {activePanel.formFields?.length ? (
          <form className="feature-workspace__form" onSubmit={(event) => event.preventDefault()}>
            {activePanel.formFields.map((field) => (
              <label key={field.label}>
                <span>{field.label}</span>
                {renderField(field)}
              </label>
            ))}
            {activePanel.actions?.length ? (
              <div className="feature-workspace__actions">
                {activePanel.actions.map((action) => (
                  <React.Fragment key={action.label}>
                    {renderDisabledActionButton(
                      action,
                      `touch-button feature-workspace__action feature-workspace__action--${action.tone ?? "secondary"}`,
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : null}
          </form>
        ) : activePanel.actions?.length ? (
          <div className="feature-workspace__actions">
            {activePanel.actions.map((action) => (
              <React.Fragment key={action.label}>
                {renderDisabledActionButton(
                  action,
                  `touch-button feature-workspace__action feature-workspace__action--${action.tone ?? "secondary"}`,
                )}
              </React.Fragment>
            ))}
          </div>
        ) : null}

        {activePanel.rows?.length ? (
          <div className="feature-workspace__rows">
            {activePanel.rows.map((row) => (
              <article className="feature-workspace__row" key={`${row.title}-${row.meta}`}>
                <div>
                  <strong>{row.title}</strong>
                  <span>{row.meta}</span>
                  {row.body ? <p>{row.body}</p> : null}
                  {row.actions?.length ? (
                    <div className="feature-workspace__row-actions" aria-label={`${row.title} 처리`}>
                      {row.actions.map((action) => (
                        <React.Fragment key={action.label}>
                          {renderDisabledActionButton(
                            action,
                            `feature-workspace__row-action feature-workspace__row-action--${action.tone ?? "secondary"}`,
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : null}
                </div>
                <em>{row.status}</em>
              </article>
            ))}
          </div>
        ) : null}

        {activePanel.emptyState ? (
          <aside className="feature-workspace__empty-state" aria-label={`${activePanel.heading} 빈 상태 안내`}>
            <strong>{activePanel.emptyState.title}</strong>
            <p>{activePanel.emptyState.body}</p>
            {activePanel.emptyState.actionLabel ? (
              <button
                aria-disabled="true"
                aria-label={`${activePanel.emptyState.actionLabel} — ${DEFAULT_DISABLED_ACTION_REASON}`}
                className="feature-workspace__empty-action"
                disabled
                title={DEFAULT_DISABLED_ACTION_REASON}
                type="button"
              >
                {activePanel.emptyState.actionLabel}
              </button>
            ) : null}
          </aside>
        ) : null}

        {activePanel.notes?.length ? (
          <ul className="feature-workspace__notes">
            {activePanel.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
