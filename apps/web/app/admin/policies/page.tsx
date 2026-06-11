import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { adminPolicyReviewChecklist, adminPolicySections } from "../../../admin-skeleton-config";

export default function AdminPoliciesPage() {
  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      eyebrow="Phase 13 관리자 콘솔 1차"
      title="관리자 / 정책"
      description="근태·휴가·결재·문서·게시판 정책을 실제 저장 전에 current/candidate/capability 형식으로 비교하는 화면입니다."
      actions={<Pill tone="warning">candidate only</Pill>}
    >
      <SurfaceSection
        title="정책 카드 공통 형식"
        description="모든 정책 카드는 현재 운영 기준, candidate 변경안, 필요 capability, 감사 preview 를 같은 순서로 보여 줍니다."
      >
        <ul className="summary-list">
          {adminPolicyReviewChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <div className="page-shell__content">
        {adminPolicySections.map((section) => (
          <SurfaceSection
            key={section.title}
            title={section.title}
            description="실제 반영 대신 운영자가 같은 기준으로 비교·검토할 수 있게 정리한 카드입니다."
          >
            <div className="grid-auto-compact">
              <article className="info-card">
                <Pill tone="accent">현재 운영 기준</Pill>
                <p>{section.currentState}</p>
              </article>
              <article className="info-card">
                <Pill tone="accent">candidate 변경안</Pill>
                <p>{section.candidateState}</p>
              </article>
              <article className="info-card">
                <Pill>필요 capability</Pill>
                <p>{section.capability}</p>
              </article>
              <article className="info-card">
                <Pill>감사 preview</Pill>
                <p>{section.auditPreview}</p>
              </article>
            </div>
            <p className="card-note">비노출 기준: {section.maskingNote}</p>
          </SurfaceSection>
        ))}
      </div>
    </PageShell>
  );
}
