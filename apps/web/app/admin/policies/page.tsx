import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { adminPolicyPreview, adminPolicyReviewChecklist, adminPolicySections, attendanceRegistrationMethodLabels } from "../../../admin-skeleton-config";

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
            {section.priorityDescription || typeof section.appliedEmployeeCount === "number" ? (
              <div className="grid-auto-compact" style={{ marginTop: 16 }}>
                {section.priorityDescription ? (
                  <article className="info-card">
                    <Pill>우선순위</Pill>
                    <p>{section.priorityDescription}</p>
                  </article>
                ) : null}
                {typeof section.appliedEmployeeCount === "number" ? (
                  <article className="info-card">
                    <Pill>예상 적용 인원</Pill>
                    <p>예상 적용 인원 {section.appliedEmployeeCount}명</p>
                  </article>
                ) : null}
              </div>
            ) : null}
            {section.sampleEmployees?.length ? (
              <div style={{ marginTop: 16 }}>
                <p className="meta-copy">샘플 직원 미리보기</p>
                <ul className="summary-list">
                  {section.sampleEmployees.map((employee) => (
                    <li key={employee.employeeId}>
                      {employee.name}: {employee.summary} · 허용 방식 {employee.allowedMethodsLabel}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {section.duplicateWarnings?.length ? (
              <ul className="summary-list" style={{ marginTop: 16 }}>
                {section.duplicateWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <p className="card-note" style={{ marginTop: 16 }}>
              비노출 기준: {section.maskingNote}
            </p>
          </SurfaceSection>
        ))}
      </div>

      <SurfaceSection
        title="적용 우선순위와 예상 영향"
        description="근태 등록 방식 정책은 회사 기본 → 근무지/지점 → 부서/팀 → 직무/역할 순서로 비교합니다."
      >
        <div className="grid-auto-compact">
          {adminPolicyPreview.scopeSummaries.map((item) => (
            <article key={item.id} className="info-card">
              <Pill tone="accent">{item.policyTargetLabel}</Pill>
              <p>우선순위: {item.priorityRank}</p>
              <p>예상 적용 인원: {item.appliedEmployeeCount}명</p>
              <p>
                허용 방식: {item.allowedAttendanceRegistrationMethods.map((method) => attendanceRegistrationMethodLabels[method]).join(", ")}
              </p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="샘플 직원 미리보기와 중복 경고"
        description="같은 정책이라도 소속별로 무엇이 적용되는지와 중복 경고를 함께 확인합니다."
      >
        <div className="grid-auto-compact">
          {adminPolicyPreview.sampleEmployees.map((employee) => (
            <article key={employee.employeeId} className="info-card">
              <Pill>{employee.employeeId}</Pill>
              <p>{employee.summary}</p>
              <p>허용 방식: {employee.effectiveAttendanceRegistrationMethods.map((method) => attendanceRegistrationMethodLabels[method]).join(", ")}</p>
            </article>
          ))}
        </div>
        {adminPolicyPreview.duplicateWarnings.length ? (
          <ul className="summary-list" style={{ marginTop: 16 }}>
            {adminPolicyPreview.duplicateWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </SurfaceSection>
    </PageShell>
  );
}
