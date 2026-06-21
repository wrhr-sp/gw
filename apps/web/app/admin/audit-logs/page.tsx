import React from "react";
import { getViewerAccessForRoleCode, hasAdminRouteAccess, hasSensitiveWorkbenchRouteAccess, type RoleCode } from "@gw/shared";

import { AuditLogsLiveSection } from "../../_components/phase34-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import {
  adminAuditBoundaryNotes,
  adminAuditDetailFields,
  adminAuditLogPreviewFilters,
  adminAuditNotes,
  adminAuditTimelineItems,
} from "../../../admin-skeleton-config";

const auditGuardRoles = ["AUDITOR", "HR_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"] as const satisfies readonly RoleCode[];

const roleLandingRouteLabels: Record<(typeof auditGuardRoles)[number], string> = {
  AUDITOR: "/admin/audit-logs",
  HR_ADMIN: "/dashboard → /admin/users",
  COMPANY_ADMIN: "/dashboard → /management 또는 /admin",
  MANAGER: "/dashboard → /management",
  EMPLOYEE: "/dashboard",
};

const guardStatusLabel = (allowed: boolean, allowedLabel: string, blockedLabel: string) => (allowed ? allowedLabel : blockedLabel);

const auditGuardRows = auditGuardRoles.map((roleCode) => {
  const viewer = getViewerAccessForRoleCode(roleCode);
  return {
    roleCode,
    landingRoute: roleLandingRouteLabels[roleCode],
    auditRoute: guardStatusLabel(hasAdminRouteAccess("/admin/audit-logs", viewer), "허용", "차단"),
    adminUsersRoute: guardStatusLabel(hasAdminRouteAccess("/admin/users", viewer), "허용", "차단"),
    managementRoute: guardStatusLabel(hasSensitiveWorkbenchRouteAccess("/management", viewer), "허용", "차단"),
    healthRoute: "허용",
  };
});

const storagePreviewNotes = [
  "before/after 는 raw 원문이 아니라 masked preview 로만 확인합니다.",
  "storageRef 는 fileId / spaceId / versionId / storageStatus 수준의 참조 요약입니다.",
  "raw storageKey / bucket / signed URL / public URL 전문은 감사 응답과 화면에 노출하지 않습니다.",
] as const;

const approvalGateNotes = [
  "감사 export/download/external sink 는 이번 단계 완료 기준이 아닙니다.",
  "감사 화면의 목적은 누가 무엇을 바꿨는지 검토하는 것이지 파일 원문을 여는 것이 아닙니다.",
  "production 실데이터 보정, migration, secret 입력은 별도 승인 게이트로 유지합니다.",
] as const;

const opsBaselineNotes = [
  "/api/health 는 service / status / version 을 확인하는 최소 liveness 기준입니다.",
  "preview smoke 와 build/release gate 는 경로가 열리는지 확인하는 운영 최소 근거입니다.",
  "RUNBOOK.md 와 DEPLOYMENT.md 는 장애 대응·배포 확인 순서를 설명하는 문서이며, 전용 관제 dashboard 를 대신한다고 쓰지 않습니다.",
  "backup/restore/incident 대응은 아직 수동 절차와 승인 게이트 중심입니다.",
] as const;

export default function AdminAuditLogsPage() {
  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      eyebrow="Phase 56 감사 read-only / audit.read 경계 확인"
      title="관리자 / 감사 로그"
      titleHref="/admin/audit-logs"
      description="감사 로그 read-only 응답, 조회 필터, masked metadata, storageRef 요약, company boundary 를 실제 API 기준으로 확인하는 화면입니다."
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

      <SurfaceSection title="역할별 route/API guard 요약" description="메뉴 숨김이 아니라 실제 route/API guard 기준으로 누가 어느 운영 레인을 여는지 같은 표로 고정합니다.">
        <div className="grid-auto-compact">
          {auditGuardRows.map((item) => (
            <article key={item.roleCode} className="info-card">
              <Pill>{item.roleCode}</Pill>
              <h3>{item.landingRoute}</h3>
              <ul className="summary-list">
                <li>/admin/audit-logs: {item.auditRoute}</li>
                <li>/admin/users: {item.adminUsersRoute}</li>
                <li>/management: {item.managementRoute}</li>
                <li>/api/health: {item.healthRoute}</li>
              </ul>
            </article>
          ))}
        </div>
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

      <SurfaceSection title="운영 최소 기준선" description="감사 화면을 운영 관제 전체와 혼동하지 않도록, 지금 실제 근거가 있는 최소 확인 세트를 함께 적습니다.">
        <ul className="summary-list">
          {opsBaselineNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="storage preview 경계" description="storage 흔적이 보이더라도 참조 요약만 보여 주고 raw 저장소 정보는 숨깁니다.">
        <ul className="summary-list">
          {storagePreviewNotes.map((item) => (
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
          {approvalGateNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
