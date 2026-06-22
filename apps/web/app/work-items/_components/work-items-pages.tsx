import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import {
  getWorkItemModuleCard,
  workItemModuleCards,
  type WorkItemModuleKey,
} from "../work-items-config";

export function WorkItemModulePage({ module }: { module: Exclude<WorkItemModuleKey, "hub"> }) {
  const card = getWorkItemModuleCard(module);
  if (!card) {
    return null;
  }

  return (
    <PageShell
      backHref="/home"
      backLabel="홈으로"
      eyebrow="Phase 37 모듈별 민감자료 경계"
      title={card.title}
      description={card.summary}
      actions={
        <div className="pill-row">
          <Pill tone="accent">{card.roleScope}</Pill>
          <Pill>{card.slug}</Pill>
        </div>
      }
    >
      <SurfaceSection title="권한/범위 메모" description="회사/지점/역할 경계를 먼저 설명합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <h3>접근 메모</h3>
            <p>{card.accessNote}</p>
          </article>
          <article className="info-card">
            <h3>역할 범위</h3>
            <p>{card.roleScope}</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="이번 단계 체크포인트" description="실제 저장보다 먼저 맞추는 skeleton 항목입니다.">
        <ul className="summary-list">
          {card.milestones.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="연결 API" description="화면 자리와 함께 읽기 API 이름을 노출합니다.">
        <ul className="summary-list">
          {card.apiRoutes.map((route) => (
            <li key={route}>
              <a href={route}>{route}</a>
            </li>
          ))}
        </ul>
      </SurfaceSection>

      {card.detailSections?.map((section) => (
        <SurfaceSection key={section.title} title={section.title} description="Phase 26 skeleton 설명을 같은 화면 언어로 고정합니다.">
          <ul className="summary-list">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SurfaceSection>
      ))}

      <SurfaceSection title="같이 보는 다른 모듈" description="하단 탭을 늘리지 않고 허브 안에서 이동합니다." muted>
        <div className="grid-auto-compact">
          {workItemModuleCards
            .filter((candidate) => candidate.slug !== card.slug)
            .map((candidate) => (
              <article key={candidate.href} className="route-card">
                <h3>{candidate.title}</h3>
                <p>{candidate.summary}</p>
                <a href={candidate.href}>{candidate.href}</a>
              </article>
            ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
