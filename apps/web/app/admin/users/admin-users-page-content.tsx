import React from "react";
import Link from "next/link";
import { appRoutes, type AdminAccountStatus, type AdminUserSummary, type AdminUsersListResponse, type RoleCode } from "@gw/shared";

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
  active: "재직",
  locked: "잠금",
  disabled: "비활성",
  offboarded: "퇴사",
  suspended: "휴직",
};

const employmentLabels: Record<string, string> = {
  active: "재직",
  on_leave: "휴직",
  offboarded: "퇴사",
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "총괄관리자",
  COMPANY_ADMIN: "회사관리자",
  HR_ADMIN: "인사관리자",
  MANAGER: "관리자",
  EMPLOYEE: "사원",
  AUDITOR: "감사담당자",
};

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function getEmploymentLabel(status: string) {
  return employmentLabels[status] ?? status;
}

function getRoleLabel(roleCode: string) {
  return roleLabels[roleCode] ?? roleCode;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 10);
}

const statusOptions: Array<{ value: AdminAccountStatus; label: string }> = [
  { value: "active", label: "재직" },
  { value: "locked", label: "잠금" },
  { value: "disabled", label: "비활성" },
  { value: "offboarded", label: "퇴사" },
  { value: "suspended", label: "휴직" },
];

const roleOptions: RoleCode[] = ["EMPLOYEE", "MANAGER", "HR_ADMIN", "COMPANY_ADMIN", "AUDITOR"];

type AdminUserItem = AdminUserSummary;

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
};

function EmployeeField({ label, children, required }: FieldProps) {
  return (
    <label className="employee-info-field">
      <span>{label}{required ? <b aria-hidden="true"> *</b> : null}</span>
      {children}
    </label>
  );
}

function EmployeeInfoPanel({ item }: { item: AdminUserItem }) {
  const primaryRole = item.roleCodes[0] ?? "EMPLOYEE";

  return (
    <details className="employee-info-drawer">
      <summary>
        <span>사원정보 / 인사정보</span>
        <small>{item.fullName} 상세</small>
      </summary>
      <div className="employee-info-dialog" role="group" aria-label={`${item.fullName} 사원정보 상세`}>
        <div className="employee-info-dialog__header">
          <div className="employee-info-tabs" aria-label="사원정보 탭">
            <span className="employee-info-tab employee-info-tab--active">사원정보</span>
            <span className="employee-info-tab">인사정보</span>
          </div>
          <button type="button" className="employee-info-print" disabled>인사정보 프린트</button>
        </div>
        <div className="employee-info-subtabs" aria-label="계정 상세 구분">
          <span className="employee-info-subtab employee-info-subtab--active">계정</span>
          <span className="employee-info-subtab">권한</span>
        </div>
        <div className="employee-info-form-grid">
          <div className="employee-info-column">
            <EmployeeField label="이름" required><input readOnly value={item.fullName} /></EmployeeField>
            <EmployeeField label="아이디" required><input readOnly value={item.email.split("@")[0] ?? item.userId} /></EmployeeField>
            <EmployeeField label="비밀번호" required><button type="button" disabled>비밀번호 변경</button></EmployeeField>
            <EmployeeField label="간편 비밀번호"><button type="button" disabled>간편 비밀번호 초기화</button></EmployeeField>
            <EmployeeField label="직원구분" required>
              <select disabled defaultValue={item.accountType}><option>{item.accountType}</option></select>
            </EmployeeField>
            <EmployeeField label="입사일자" required><input readOnly value={formatDate(item.lastLoginAt)} /></EmployeeField>
            <EmployeeField label="인정입사일자"><input readOnly value={formatDate(item.lastLoginAt)} /></EmployeeField>
            <EmployeeField label="부서 · 직책"><input readOnly value={`${item.departmentName} · ${getRoleLabel(primaryRole)}`} /></EmployeeField>
            <EmployeeField label="퇴사일자"><input readOnly value={item.employmentStatus === "offboarded" ? "퇴사 처리됨" : ""} /></EmployeeField>
          </div>
          <div className="employee-info-column">
            <EmployeeField label="직위" required>
              <select disabled defaultValue={getRoleLabel(primaryRole)}><option>{getRoleLabel(primaryRole)}</option></select>
            </EmployeeField>
            <EmployeeField label="직급">
              <select disabled defaultValue={getRoleLabel(primaryRole)}><option>{getRoleLabel(primaryRole)}</option></select>
            </EmployeeField>
            <EmployeeField label="사용자그룹"><span className="employee-chip-row"><span>{item.roleCodes.map(getRoleLabel).join(", ")}</span><button type="button" disabled>+ 추가</button></span></EmployeeField>
            <EmployeeField label="주민등록번호"><span className="employee-split-field"><input readOnly value="" /><input readOnly value="" aria-label="주민등록번호 뒷자리" /></span></EmployeeField>
            <EmployeeField label="인식번호(사번/학번)"><input readOnly value={item.employeeId} /></EmployeeField>
            <EmployeeField label="계정 상태"><span className="employee-radio-row"><span>● {getStatusLabel(item.accountStatus)}</span><span>○ 중지</span><span>○ 휴면</span></span></EmployeeField>
            <EmployeeField label="언어"><select disabled defaultValue="한국어"><option>한국어</option></select></EmployeeField>
            <EmployeeField label="외부 이메일"><input readOnly value={item.email} /></EmployeeField>
            <EmployeeField label="만료일자"><input readOnly value={item.mustChangePassword ? "비밀번호 변경 필요" : ""} /></EmployeeField>
            <EmployeeField label="고위험 권한"><input readOnly value={`고위험 권한: ${item.highRiskPermissions.length > 0 ? item.highRiskPermissions.join(", ") : "없음"}`} /></EmployeeField>
          </div>
        </div>
        <div className="employee-info-dialog__footer">
          <button type="button" disabled>취소</button>
          <button type="button" disabled>저장</button>
        </div>
      </div>
    </details>
  );
}

function AdminUserActionCard({ item }: { item: AdminUserItem }) {
  const defaultReason = "사원정보관리 계정/권한 변경 검증";

  return (
    <article className="route-card employee-admin-action-card">
      <h3>{item.fullName}</h3>
      <p className="card-note">현재 {getStatusLabel(item.accountStatus)} · {item.roleCodes.map(getRoleLabel).join(", ")}</p>
      <form method="post" action={appRoutes.admin.userStatus(item.userId)}>
        <label>
          재직상태
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
          직위/권한
          <select name="roleCode" defaultValue={item.roleCodes[0] ?? "EMPLOYEE"}>
            {roleOptions.map((option) => <option key={option} value={option}>{getRoleLabel(option)}</option>)}
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
  const loadErrorTitle = loadErrorKind === "offline" ? "네트워크 재확인 필요" : "계정관리 조회 실패";

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

      <SurfaceSection title="계정관리 목록">
        <div className="employee-management-toolbar" aria-label="계정관리 검색 조건">
          <label>
            재직상태
            <select defaultValue="전체">
              <option>전체</option>
              <option>재직</option>
              <option>휴직</option>
              <option>퇴사</option>
            </select>
          </label>
          <label className="employee-management-toolbar__search">
            검색
            <input aria-label="이름, 부서, 사번 검색" readOnly />
          </label>
          <button type="button" disabled>조회</button>
          <button type="button" disabled>조건추가</button>
        </div>
        <div className="employee-management-actions" aria-label="계정관리 작업">
          <button type="button" disabled>계정 생성</button>
          <button type="button" disabled>계정 삭제</button>
          <button type="button" disabled>정보 수정</button>
          <span>전체: {totalCount}명</span>
        </div>
        {items.length > 0 ? (
          <div className="employee-management-table-wrap">
            <table className="employee-management-table">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="전체 선택" disabled /></th>
                  <th>이름</th>
                  <th>ID</th>
                  <th>직원구분</th>
                  <th>재직상태</th>
                  <th>직위</th>
                  <th>직책</th>
                  <th>사용자그룹</th>
                  <th>부서</th>
                  <th>입사일</th>
                  <th>재직기간</th>
                  <th>계정상태</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const primaryRole = item.roleCodes[0] ?? "EMPLOYEE";
                  return (
                    <tr key={item.userId}>
                      <td><input type="checkbox" aria-label={`${item.fullName} 선택`} disabled /></td>
                      <td>{item.fullName}</td>
                      <td>{item.email}</td>
                      <td>{item.accountType}</td>
                      <td>{getEmploymentLabel(item.employmentStatus)}</td>
                      <td>{getRoleLabel(primaryRole)}</td>
                      <td>{item.roleCodes.includes("MANAGER") ? "팀장" : "-"}</td>
                      <td>{item.roleCodes.map(getRoleLabel).join(", ") || "-"}</td>
                      <td>{item.departmentName}</td>
                      <td>{formatDate(item.lastLoginAt)}</td>
                      <td>{item.activeSessionCount > 0 ? `${item.activeSessionCount}개 세션` : "-"}</td>
                      <td>{getStatusLabel(item.accountStatus)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <article className="info-card">
            <h3>조회된 계정이 없습니다</h3>
          </article>
        )}
      </SurfaceSection>


      <SurfaceSection title="계정 · 권한 상세">
        {items.length > 0 ? (
          <div className="employee-info-drawer-list">
            {items.slice(0, 3).map((item) => <EmployeeInfoPanel key={`detail-${item.userId}`} item={item} />)}
          </div>
        ) : (
          <article className="info-card"><h3>계정을 불러온 뒤 상세 폼을 확인할 수 있습니다</h3></article>
        )}
      </SurfaceSection>

      <SurfaceSection title="계정 현황">
        <div className="grid-auto-compact">
          <article className="info-card"><Pill tone="accent">전체</Pill><h3>{totalCount}명</h3></article>
          <article className="info-card"><Pill tone="accent">재직</Pill><h3>{activeCount}명</h3></article>
          <article className="info-card"><Pill tone="warning">잠금</Pill><h3>{lockedCount}명</h3></article>
          <article className="info-card"><Pill tone="warning">퇴사</Pill><h3>{offboardedCount}명</h3></article>
          <article className="info-card"><Pill>관리자</Pill><h3>{adminCount}명</h3></article>
          <article className="info-card"><Pill tone={highRiskCount > 0 ? "warning" : "accent"}>고위험 권한</Pill><h3>{highRiskCount}명</h3></article>
        </div>
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
            <article className="route-card"><h3>감사로그</h3><p className="card-note">계정/권한 변경은 저장 뒤 관리자 감사로그에 남습니다.</p><Link href="/admin/audit-logs">열기</Link></article>
          </div>
        ) : (
          <article className="route-card"><h3>관리자 작업</h3><p className="card-note">계정을 불러온 뒤 상태/역할 저장을 실행할 수 있습니다.</p><Link href="/admin/audit-logs">감사로그</Link></article>
        )}
      </SurfaceSection>
    </PageShell>
  );
}
