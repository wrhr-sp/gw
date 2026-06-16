import React from "react";

import { AuditLogsLiveSection } from "../../_components/phase34-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import {
  adminAuditBoundaryNotes,
  adminAuditDetailFields,
  adminAuditLogPreviewFilters,
  adminAuditNotes,
  adminAuditTimelineItems,
} from "../../../admin-skeleton-config";

export default function AdminAuditLogsPage() {
  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      eyebrow="Phase 34 감사 운영흐름 실사용화"
      title="관리자 / 감사 로그"
      description="감사 로그 read-only 응답, 조회 필터, masked metadata, company boundary 를 실제 API 기준으로 확인하는 화면입니다."
      actions={<Pill tone="warning">audit.read</Pill>}
    >
      <SurfaceSection title="실사용 감사 패널" description="감사 로그 목록과 필터 옵션을 실제 응답으로 먼저 확인합니다.">
        <AuditLogsLiveSection />
      </SurfaceSection>

      <SurfaceSection
        title="감사 전용 진입 의미"
        description="감사 전용 사용자는 이 화면을 기본 진입점으로 보지만, 이것이 `/admin` 전체 허용을 뜻하지는 않습니다."
      >
        <ul className="summary-list">
          <li>감사 전용 사용자는 read-only 추적과 company boundary 확인에 집중합니다.</li>
          <li>사용자/정책 수정 화면 접근은 route/API guard 로 계속 분리합니다.</li>
          <li>masked fields 와 source 는 설명용 메타데이터이지 민감 원문이나 외부 전송 완료 의미가 아닙니다.</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="조회 필터" description="누가, 무엇을, 어디에 대해, 언제 확인했는지 같은 질문을 빠르게 좁히는 기본 필터입니다.">
        <div className="grid-auto-compact">
          {adminAuditLogPreviewFilters.map((item) => (
            <article key={item} className="info-card">
              <Pill>{item}</Pill>
              <p>{item} 기준으로 최근 이벤트를 다시 정렬합니다.</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="최근 이벤트 타임라인" description="최근에 열린 사용자 권한 검토, 정책 candidate 변경, 감사 조회 이벤트를 source 와 함께 보여 줍니다.">
        <div className="grid-auto-compact">
          {adminAuditTimelineItems.map((item) => (
            <article key={item.title} className="route-card">
              <Pill>{item.source}</Pill>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="상세 패널" description="선택한 이벤트는 표시 이름, 변경 사유, before/after 요약, masked fields, source 까지만 펼쳐 봅니다.">
        <ul className="summary-list">
          {adminAuditDetailFields.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="비노출/회사 경계" description="감사 조회 화면도 같은 회사 안의 마스킹된 메타데이터만 보여 주고 외부 반출은 허용하지 않습니다." muted>
        <ul className="bullet-list">
          {adminAuditNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {adminAuditBoundaryNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
