import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { managementWorkItemCards } from "../work-items/work-items-config";

export default function ManagementPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="경영업무 분리 IA"
      title="경영업무"
      description="법무 같은 민감 운영 모듈은 일반 직원용 업무 허브와 섞지 않고 지정 관리자·담당자만 별도 영역에서 확인합니다."
      actions={
        <div className="pill-row">
          <Pill tone="warning">sensitive access</Pill>
          <Pill>route + UI guard</Pill>
        </div>
      }
    >
      <SurfaceSection title="민감 모듈 진입" description="현재 단계에서는 법무를 먼저 분리하고, 같은 구조의 민감 운영 모듈은 이후 이 영역으로 확장합니다.">
        <div className="grid-auto-compact">
          {managementWorkItemCards.map((card) => (
            <article key={card.href} className="info-card">
              <Pill tone="warning">{card.roleScope}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.accessNote}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="분리 원칙" description="단순 메뉴 숨김이 아니라 같은 제품 기준을 경영업무 entrypoint 에서도 반복합니다." muted>
        <ul className="summary-list">
          <li>일반 직원 메뉴와 공통 업무 허브에서는 법무 entry를 노출하지 않습니다.</li>
          <li>허용 역할만 `/management`, `/work-items/legal` 경로로 진입할 수 있습니다.</li>
          <li>API scope, 회사/지점 경계, 감사 흔적 기준은 기존 legal placeholder와 같은 정책을 유지합니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
