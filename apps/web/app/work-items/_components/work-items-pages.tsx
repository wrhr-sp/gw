import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import {
  getWorkItemModuleCard,
  workItemGuardrails,
  workItemHubHighlights,
  workItemHubModuleCards,
  workItemModuleCards,
  type WorkItemModuleKey,
} from "../work-items-config";

export function WorkItemsHubPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 37 공통 업무 저장흐름 점검"
      title="공통 업무 허브"
      description="HR·세무·노무·법무·지점 업무를 개별 앱처럼 늘리지 않고 공통 work item, 문서, 첨부, 검토, 마감 설명 구조를 metadata preview / approval gate 언어로 먼저 묶는 skeleton 화면입니다."
    >
      <SurfaceSection title="이번 패스에서 먼저 고정한 것" description="실운영 자동화 전에 정보 구조와 권한 설명을 먼저 맞춥니다.">
        <ul className="summary-list">
          {workItemHubHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="모듈별 진입점" description="같은 허브 아래에서 역할별로 어디까지 보여 줄지 먼저 나눕니다.">
        <div className="grid-auto-compact">
          {workItemHubModuleCards.map((card) => (
            <article key={card.href} className="info-card">
              <Pill tone="accent">{card.roleScope}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.accessNote}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="읽기 API 골격" description="UI 자리와 같은 이름으로 API 골격을 확인할 수 있게 맞춥니다.">
        <div className="grid-auto-compact">
          <article className="route-card">
            <h3>공통 목록/상세</h3>
            <p>/api/work-items, /api/work-items/:id</p>
          </article>
          <article className="route-card">
            <h3>문서/첨부/검토</h3>
            <p>/api/work-items/:id/documents · /attachments · /reviews</p>
          </article>
          <article className="route-card">
            <h3>마감 보기</h3>
            <p>/api/work-item-deadlines</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="고정 가드레일" description="운영처럼 보이더라도 과장하지 않기 위한 기준입니다." muted>
        <ul className="bullet-list">
          {workItemGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}

export function WorkItemModulePage({ module }: { module: Exclude<WorkItemModuleKey, "hub"> }) {
  const card = getWorkItemModuleCard(module);
  if (!card) {
    return null;
  }

  return (
    <PageShell
      backHref="/work-items"
      backLabel="공통 업무 허브로"
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
