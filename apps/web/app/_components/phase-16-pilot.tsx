import React from "react";

import { Pill, SurfaceSection } from "./page-shell";

export type Phase16PilotRoute = {
  href: string;
  label: string;
  description: string;
};

export type Phase16PilotPanelProps = {
  title?: string;
  description: string;
  confirmItems: readonly string[];
  blockedItems?: readonly string[];
  nextRoutes?: readonly Phase16PilotRoute[];
  approvalGates?: readonly string[];
  evidenceNote?: string;
};

export function Phase16PilotPanel({
  title = "Phase 16 파일럿 체크",
  description,
  confirmItems,
  blockedItems = [],
  nextRoutes = [],
  approvalGates = [],
  evidenceNote,
}: Phase16PilotPanelProps) {
  return (
    <SurfaceSection title={title} description={description}>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">이번 화면에서 확인할 것</Pill>
          <ul className="summary-list" style={{ marginTop: 12 }}>
            {confirmItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        {blockedItems.length ? (
          <article className="info-card">
            <Pill tone="warning">아직 안 여는 것</Pill>
            <ul className="summary-list" style={{ marginTop: 12 }}>
              {blockedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ) : null}
        {approvalGates.length ? (
          <article className="info-card">
            <Pill>승인 게이트</Pill>
            <ul className="summary-list" style={{ marginTop: 12 }}>
              {approvalGates.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ) : null}
      </div>

      {nextRoutes.length ? (
        <div style={{ marginTop: 16 }}>
          <p className="meta-copy">live URL/preview 에서 이어서 눌러 볼 route</p>
          <ul className="summary-list">
            {nextRoutes.map((route) => (
              <li key={`${route.href}-${route.label}`}>
                <a href={route.href}>{route.label}</a> — {route.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evidenceNote ? <p className="card-note" style={{ marginTop: 16 }}>검증 메모: {evidenceNote}</p> : null}
    </SurfaceSection>
  );
}
