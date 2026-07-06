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

const accountTypeOptions = [
  { value: "employee", label: "직원" },
  { value: "admin", label: "관리자" },
  { value: "external", label: "외부 사용자" },
  { value: "bot_service", label: "봇/서비스 계정" },
  { value: "system", label: "시스템 계정" },
] as const;

const accountCreationStatusOptions: Array<{ value: AdminAccountStatus; label: string }> = [
  { value: "invited", label: "초대대기" },
  { value: "active", label: "활성" },
  { value: "locked", label: "잠금" },
  { value: "disabled", label: "비활성" },
  { value: "offboarded", label: "퇴사처리" },
  { value: "suspended", label: "일시정지" },
];

const accountCreationValidationChecks = [
  "필수값: 이름, 로그인 ID/이메일, 부서, 지점, 초기 역할",
  "중복 후보: 같은 이메일·로그인 ID·사번 존재 여부",
  "권한 위험도: HR_ADMIN, COMPANY_ADMIN, AUDITOR 같은 관리자 권한 부여 여부",
  "조직 연결: 회사 scope, 부서, 지점, 직책/직급 연결 상태",
  "보안 상태: 최초 비밀번호 변경 필요, 2단계 인증 필요 여부",
  "감사 후보: 계정 생성 요청자, 사유, 생성 전 검증 결과",
] as const;

const employeeManagementFeatureOrder = [
  { label: "사원 목록", summary: "검색·필터·정렬과 사원 선택의 시작점" },
  { label: "사원 등록 / 계정 생성", summary: "운영 DB에 사원과 계정을 함께 저장" },
  { label: "사원 기본정보", summary: "이름, 이메일, 사번, 입사일, 재직 상태" },
  { label: "조직 / 지점 / 직무", summary: "회사, 부서, 지점, 직책·직급, 발령 이력" },
  { label: "계정 / 역할 / 권한", summary: "계정 유형, 역할, 고위험 권한, 권한 변경 사유" },
  { label: "보안 설정", summary: "비밀번호 변경, 2단계 인증, 로그인 실패, 세션" },
  { label: "근무 / 재직 상태", summary: "휴직, 잠금, 비활성, 퇴사와 권한 회수 후보" },
  { label: "인사 서류 / 계약", summary: "근로계약서, 동의서, 증명서, 인사 발령 문서 연결" },
  { label: "근태 / 휴가 연결", summary: "해당 사원의 근태·휴가 요약과 관련 화면 연결" },
  { label: "급여 연결", summary: "급여 대상 여부와 급여 화면 연결, 민감정보는 별도 보안" },
  { label: "업무 접근 / 포털 접근", summary: "기본업무, 부서업무포털, 지점관리포털, 관리자 접근" },
] as const;

const employeeDetailTabs = [
  "기본정보",
  "조직/직무",
  "계정/권한",
  "보안",
  "재직상태",
  "서류/계약",
  "근태/휴가",
  "급여",
  "접근권한",
] as const;

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

function EmployeeManagementOrderPanel() {
  return (
    <SurfaceSection title="사원정보관리 구성 순서">
      <ol className="summary-list" aria-label="사원정보관리 기능 항목 순서">
        {employeeManagementFeatureOrder.map((item, index) => (
          <li key={item.label}>
            <strong>{String(index + 1).padStart(2, "0")}. {item.label}</strong>
            <span> — {item.summary}</span>
          </li>
        ))}
      </ol>
    </SurfaceSection>
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
        <div className="employee-info-subtabs" aria-label="상세 정보 구분">
          {employeeDetailTabs.map((tab, index) => (
            <span key={tab} className={index === 0 ? "employee-info-subtab employee-info-subtab--active" : "employee-info-subtab"}>{tab}</span>
          ))}
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

function AccountCreationPanel({ existingUsers }: { existingUsers: readonly AdminUserItem[] }) {
  const existingEmailExamples = existingUsers.slice(0, 3).map((item) => item.email).join(" · ") || "현재 조회된 계정 없음";

  return (
    <SurfaceSection title="계정생성 1차 검증">
      <div className="employee-management-toolbar" aria-label="계정생성 입력 조건">
        <form method="post" action={appRoutes.admin.userCreate} className="employee-info-form-grid">
          <input type="hidden" name="actionType" value="create" />
          <div className="employee-info-column">
            <EmployeeField label="이름" required><input name="fullName" aria-label="계정생성 이름" minLength={2} required /></EmployeeField>
            <EmployeeField label="로그인 ID / 이메일" required><input name="email" type="email" aria-label="계정생성 로그인 ID 또는 이메일" required /></EmployeeField>
            <EmployeeField label="부서" required><input name="departmentName" aria-label="계정생성 부서" required /></EmployeeField>
            <EmployeeField label="지점" required><input name="branchName" aria-label="계정생성 지점" required /></EmployeeField>
            <EmployeeField label="직책/직급"><input name="positionName" aria-label="계정생성 직책 또는 직급" /></EmployeeField>
          </div>
          <div className="employee-info-column">
            <EmployeeField label="계정 유형" required>
              <select name="accountType" defaultValue="employee" required>
                {accountTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </EmployeeField>
            <EmployeeField label="초기 역할" required>
              <select name="roleCode" defaultValue="EMPLOYEE" required>
                {roleOptions.map((option) => <option key={option} value={option}>{getRoleLabel(option)}</option>)}
              </select>
            </EmployeeField>
            <EmployeeField label="초기 상태" required>
              <select name="nextStatus" defaultValue="invited" required>
                {accountCreationStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </EmployeeField>
            <EmployeeField label="생성 사유" required><input name="reason" defaultValue="신규 입사/계정 생성 전 검증" minLength={1} required /></EmployeeField>
            <EmployeeField label="보안 설정"><span className="employee-radio-row"><label><input type="checkbox" name="mustChangePassword" value="true" defaultChecked /> 최초 로그인 비밀번호 변경</label><label><input type="checkbox" name="mfaRequired" value="true" /> 2단계 인증 필요</label></span></EmployeeField>
          </div>
          <div className="employee-info-dialog__footer">
            <button type="submit">계정 생성 저장</button>
          </div>
        </form>
      </div>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">DB 저장</Pill>
          <h3>계정 생성은 운영 DB에 저장하고 다시 조회합니다</h3>
          <p>저장 시 users, employees, user_roles, audit_logs를 한 트랜잭션으로 연결합니다. DB 또는 schema가 준비되지 않으면 성공처럼 보이지 않고 명확한 오류로 실패합니다.</p>
        </article>
        <article className="info-card">
          <Pill>중복 후보 기준</Pill>
          <h3>{existingEmailExamples}</h3>
          <p>동일 이메일·로그인 ID·사번 후보는 실제 목록 조회 결과와 비교해야 합니다.</p>
        </article>
        <article className="info-card">
          <Pill tone="accent">확인 항목</Pill>
          <ul className="summary-list">
            {accountCreationValidationChecks.map((check) => <li key={check}>{check}</li>)}
          </ul>
        </article>
      </div>
    </SurfaceSection>
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
  const loadErrorTitle = loadErrorKind === "offline" ? "네트워크 재확인 필요" : "사원정보 조회 실패";

  return (
    <PageShell
      backHref="/admin"
      backLabel="그룹웨어관리자로"
      eyebrow="관리자"
      title="사원정보관리"
      actions={
        <div className="pill-row">
          <Pill tone="accent">사원정보</Pill>
          <Pill tone="accent">인사정보</Pill>
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

      <EmployeeManagementOrderPanel />

      <SurfaceSection title="사원정보관리 목록">
        <div className="employee-management-toolbar" aria-label="사원정보관리 검색 조건">
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
        <div className="employee-management-actions" aria-label="사원정보관리 작업">
          <button type="button" disabled>사원 생성</button>
          <button type="button" disabled>사원 삭제</button>
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
            <h3>조회된 사원정보가 없습니다</h3>
          </article>
        )}
      </SurfaceSection>

      <AccountCreationPanel existingUsers={items} />

      <SurfaceSection title="사원정보 · 인사정보 상세">
        {items.length > 0 ? (
          <div className="employee-info-drawer-list">
            {items.slice(0, 3).map((item) => <EmployeeInfoPanel key={`detail-${item.userId}`} item={item} />)}
          </div>
        ) : (
          <article className="info-card"><h3>사원정보를 불러온 뒤 상세 폼을 확인할 수 있습니다</h3></article>
        )}
      </SurfaceSection>

      <SurfaceSection title="사원정보 현황">
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
            <article className="route-card"><h3>감사로그</h3><p className="card-note">사원정보/권한 변경은 저장 뒤 감사로그에 남습니다.</p><Link href="/admin/audit-logs">열기</Link></article>
          </div>
        ) : (
          <article className="route-card"><h3>관리자 작업</h3><p className="card-note">사원정보를 불러온 뒤 상태/역할 저장을 실행할 수 있습니다.</p><Link href="/admin/audit-logs">감사로그</Link></article>
        )}
      </SurfaceSection>
    </PageShell>
  );
}
