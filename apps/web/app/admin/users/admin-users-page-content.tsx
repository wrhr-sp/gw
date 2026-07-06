import React from "react";
import Link from "next/link";
import { appRoutes, type AdminAccountStatus, type AdminUsersListResponse, type RoleCode } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { adminOfflineGuidance, adminRecoveryRouteCards } from "../../mobile-pwa-config";

type AdminUsersPreview = Pick<AdminUsersListResponse["data"], "items" | "linkedScreens" | "companySettingsModel" | "audit">;

type AdminUsersPageContentProps = {
  adminUsers: AdminUsersPreview;
  actionMessage?: string | null;
  loadError?: string | null;
  loadErrorKind?: "error" | "offline" | null;
  actionType?: string | null;
  focusMessage?: string | null;
};

const permissionMatrix = [
  { feature: "메일", permissions: "보기 · 작성 · 발송 · 관리자 설정" },
  { feature: "게시판", permissions: "보기 · 글쓰기 · 댓글 · 공지 · 관리" },
  { feature: "문서함", permissions: "보기 · 업로드 · 다운로드 · 공간 관리" },
  { feature: "근태/휴가", permissions: "조회 · 신청 · 승인 · 정정 · 정책 관리" },
  { feature: "전자결재", permissions: "기안 · 결재 · 반려 · 결재선 관리" },
  { feature: "관리자", permissions: "사용자 관리 · 권한 관리 · 감사 조회 · 보안 설정" },
] as const;

const statusLabels: Record<string, string> = {
  invited: "초대대기",
  active: "활성",
  locked: "잠금",
  disabled: "비활성",
  offboarded: "퇴사처리",
  suspended: "일시정지",
};

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

const statusOptions: Array<{ value: AdminAccountStatus; label: string }> = [
  { value: "active", label: "활성" },
  { value: "locked", label: "잠금" },
  { value: "disabled", label: "비활성" },
  { value: "offboarded", label: "퇴사 처리" },
  { value: "suspended", label: "일시정지" },
];

const roleOptions: RoleCode[] = ["EMPLOYEE", "MANAGER", "HR_ADMIN", "COMPANY_ADMIN", "AUDITOR"];

type AdminUserItem = AdminUsersPreview["items"][number];

function AdminUserActionCard({ item }: { item: AdminUserItem }) {
  const defaultReason = "관리자페이지 2차 계정관리 검증";

  return (
    <article className="route-card">
      <h3>{item.fullName}</h3>
      <p className="card-note">현재 {getStatusLabel(item.accountStatus)} · {item.roleCodes.join(", ")}</p>
      <form method="post" action={appRoutes.admin.userStatus(item.userId)}>
        <label>
          상태
          <select name="status" defaultValue={item.accountStatus}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <input type="checkbox" name="mustChangePassword" value="true" defaultChecked={item.mustChangePassword} />
          다음 로그인 비밀번호 변경 요구
        </label>
        <label>
          변경 사유
          <input name="reason" defaultValue={defaultReason} minLength={1} />
        </label>
        <button type="submit">상태 저장</button>
      </form>
      <form method="post" action={appRoutes.admin.userRoles(item.userId)}>
        <label>
          역할
          <select name="roleCode" defaultValue={item.roleCodes[0] ?? "EMPLOYEE"}>
            {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          변경 사유
          <input name="reason" defaultValue={defaultReason} minLength={1} />
        </label>
        <button type="submit">역할 저장</button>
      </form>
    </article>
  );
}

export function AdminUsersPageContent({ adminUsers, actionMessage, loadError, loadErrorKind, focusMessage }: AdminUsersPageContentProps) {
  const items = adminUsers.items;
  const totalCount = items.length;
  const activeCount = items.filter((item) => item.accountStatus === "active").length;
  const lockedCount = items.filter((item) => item.accountStatus === "locked").length;
  const offboardedCount = items.filter((item) => item.accountStatus === "offboarded" || item.employmentStatus === "offboarded").length;
  const adminCount = items.filter((item) => item.roleCodes.some((roleCode) => roleCode === "SUPER_ADMIN" || roleCode === "COMPANY_ADMIN" || roleCode === "HR_ADMIN")).length;
  const highRiskCount = items.filter((item) => item.highRiskPermissions.length > 0).length;
  const loadErrorTitle = loadErrorKind === "offline" ? "네트워크 재확인 필요" : "사원 계정 조회 실패";

  return (
    <PageShell
      backHref="/admin"
      backLabel="그룹웨어관리자로"
      eyebrow="관리자"
      title="사원 계정 관리"
      actions={
        <div className="pill-row">
          <Pill tone="accent">계정</Pill>
          <Pill tone="accent">권한</Pill>
        </div>
      }
    >
      {actionMessage || focusMessage ? (
        <section className="status-banner" role="status">
          {actionMessage ? <span>{actionMessage}</span> : null}
          {focusMessage ? <span>{focusMessage}</span> : null}
        </section>
      ) : null}

      {loadError ? (
        <section className="status-banner status-banner--warning" role="alert">
          <strong>{loadErrorTitle}</strong>
          <span>{loadError}</span>
          {loadErrorKind === "offline" ? (
            <>
              <span>{adminOfflineGuidance.bannerBody}</span>
              <ul className="summary-list">
                {adminOfflineGuidance.retrySteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="card-note">복구 경로: {adminRecoveryRouteCards.map((route) => route.href).join(" · ")}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <SurfaceSection title="계정 현황">
        <div className="grid-auto-compact">
          <article className="info-card"><Pill tone="accent">전체</Pill><h3>{totalCount}개</h3></article>
          <article className="info-card"><Pill tone="accent">활성</Pill><h3>{activeCount}개</h3></article>
          <article className="info-card"><Pill tone="warning">잠금</Pill><h3>{lockedCount}개</h3></article>
          <article className="info-card"><Pill tone="warning">퇴사</Pill><h3>{offboardedCount}개</h3></article>
          <article className="info-card"><Pill>관리자</Pill><h3>{adminCount}개</h3></article>
          <article className="info-card"><Pill tone={highRiskCount > 0 ? "warning" : "accent"}>고위험 권한</Pill><h3>{highRiskCount}개</h3></article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="사원 계정 목록">
        {items.length > 0 ? (
          <div className="grid-auto-compact">
            {items.map((item) => (
              <article key={item.userId} className="info-card">
                <Pill tone={item.highRiskPermissions.length > 0 ? "warning" : "accent"}>{item.roleCodes.join(", ")}</Pill>
                <h3>{item.fullName}</h3>
                <p>{item.email} · {item.departmentName}</p>
                <p className="meta-copy">계정: {item.accountType} · {getStatusLabel(item.accountStatus)} · 직원 상태 {item.employmentStatus}</p>
                <p className="meta-copy">보안: 비밀번호 변경 {item.mustChangePassword ? "필요" : "완료"} · 2FA {item.twoFactorRequired ? "필수" : "미필수"} · 세션 {item.activeSessionCount}개</p>
                <p className="card-note">고위험 권한: {item.highRiskPermissions.length > 0 ? item.highRiskPermissions.join(", ") : "없음"}</p>
              </article>
            ))}
          </div>
        ) : (
          <article className="info-card">
            <h3>조회된 계정이 없습니다</h3>
          </article>
        )}
      </SurfaceSection>

      <div id="permission-matrix">
        <SurfaceSection title="기능별 권한">
          <div className="grid-auto-compact">
            {permissionMatrix.map((row) => (
              <article key={row.feature} className="info-card">
                <Pill>{row.feature}</Pill>
                <h3>{row.permissions}</h3>
              </article>
            ))}
          </div>
        </SurfaceSection>
      </div>

      <SurfaceSection title="관리자 작업">
        {items.length > 0 ? (
          <div className="grid-auto-compact">
            {items.map((item) => <AdminUserActionCard key={`action-${item.userId}`} item={item} />)}
            <article className="route-card"><h3>감사로그</h3><p className="card-note">계정/역할 변경은 저장 뒤 감사로그에 남습니다.</p><Link href="/admin/audit-logs">열기</Link></article>
          </div>
        ) : (
          <article className="route-card"><h3>관리자 작업</h3><p className="card-note">계정 데이터를 불러온 뒤 상태/역할 저장을 실행할 수 있습니다.</p><Link href="/admin/audit-logs">감사로그</Link></article>
        )}
      </SurfaceSection>
    </PageShell>
  );
}
