"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  adminUserMutationResponseSchema,
  adminUserProfileUpdateRequestSchema,
  adminUsersListResponseSchema,
  appRoutes,
  errorResponseSchema,
  type AdminUserProfileUpdateRequest,
  type AdminUserSummary,
  type RoleCode,
} from "@gw/shared";

const employeeInformationOrder = [
  "사원 목록",
  "사원 등록 / 계정 생성",
  "사원 기본정보",
  "조직 / 지점 / 직무",
  "계정 / 역할 / 권한",
  "보안 설정",
  "근무 / 재직 상태",
  "인사 서류 / 계약",
  "근태 / 휴가 연결",
  "급여 연결",
  "업무 접근 / 포털 접근",
] as const;

const roleLabels: Record<RoleCode, string> = {
  SUPER_ADMIN: "총괄관리자",
  COMPANY_ADMIN: "회사관리자",
  HR_ADMIN: "인사관리자",
  MANAGER: "관리자",
  EMPLOYEE: "사원",
  AUDITOR: "감사담당자",
};

const accountStatusLabels: Record<AdminUserSummary["accountStatus"], string> = {
  invited: "초대대기",
  active: "활성",
  locked: "잠금",
  disabled: "비활성",
  offboarded: "퇴사처리",
  suspended: "일시정지",
};

const employmentStatusLabels: Record<AdminUserSummary["employmentStatus"], string> = {
  active: "재직",
  on_leave: "휴직",
  offboarded: "퇴사",
};

function roleText(roleCodes: readonly RoleCode[]) {
  return roleCodes.map((roleCode) => roleLabels[roleCode] ?? roleCode).join(", ");
}

function formatDate(value: string | null) {
  return value ? value.slice(0, 10) : "-";
}


const employeeLinkStatusLabels: Record<AdminUserSummary["employeeLinkStatus"], string> = {
  linked: "사원 연결됨",
  unlinked: "미연결",
  review_required: "검토",
};

const adminScopeLabels: Record<AdminUserSummary["adminScope"], string> = {
  global: "전체 관리 범위",
  company: "회사 관리 범위",
  audit: "감사 관리 범위",
};

type EmployeeDetailSection = {
  title: string;
  meta?: string;
  body?: string;
  status?: string;
};

function buildEmployeeDetailSections(selected: AdminUserSummary | null): EmployeeDetailSection[] {
  if (!selected) {
    return [];
  }

  return [
    {
      title: "기본정보",
      meta: `${selected.fullName} · ${selected.email}`,
      body: `${selected.departmentName} · ${employmentStatusLabels[selected.employmentStatus]}`,
    },
    {
      title: "조직 / 지점 / 직무",
      meta: `부서: ${selected.departmentName}`,
    },
    {
      title: "계정 / 역할 / 권한",
      meta: roleText(selected.roleCodes),
      body: `고위험 권한: ${selected.highRiskPermissions.length > 0 ? selected.highRiskPermissions.join(", ") : "없음"}`,
      status: accountStatusLabels[selected.accountStatus],
    },
    {
      title: "보안 설정",
      meta: selected.mustChangePassword ? "최초 로그인 비밀번호 변경 필요" : "비밀번호 변경 요구 없음",
      body: `${selected.twoFactorRequired ? "2단계 인증 필요" : "2단계 인증 미요구"} · 실패 ${selected.failedLoginCount}회 · 세션 ${selected.activeSessionCount}개`,
      status: "계정 보안",
    },
    {
      title: "근무 / 재직 상태",
      meta: employmentStatusLabels[selected.employmentStatus],
      body: `계정 상태: ${accountStatusLabels[selected.accountStatus]} · 최근 로그인: ${formatDate(selected.lastLoginAt)}`,
    },
    {
      title: "인사 서류 / 계약",
    },
    {
      title: "근태 / 휴가 연결",
    },
    {
      title: "급여 연결",
    },
    {
      title: "업무 접근 / 포털 접근",
      meta: `${adminScopeLabels[selected.adminScope]} · ${employeeLinkStatusLabels[selected.employeeLinkStatus]}`,
    },
  ];
}

function EmployeeDetailSections({ selected }: { selected: AdminUserSummary | null }) {
  const sections = buildEmployeeDetailSections(selected);

  return (
    <div className="feature-workspace__rows" aria-label={selected ? `${selected.fullName} 사원 상세` : "사원 상세 섹션 기준"}>
      {sections.map((section) => (
        <article className="feature-workspace__row" key={section.title}>
          <div>
            <strong>{section.title}</strong>
            {section.meta ? <span>{section.meta}</span> : null}
            {section.body ? <p>{section.body}</p> : null}
          </div>
          {section.status ? <em>{section.status}</em> : null}
        </article>
      ))}
      <article className="feature-workspace__row">
        <div>
          <strong>감사로그</strong>
          <div className="feature-workspace__row-actions" aria-label="감사로그 이동">
            <Link className="feature-workspace__row-action feature-workspace__row-action--secondary" href="/admin/audit-logs">열기</Link>
          </div>
        </div>
      </article>
    </div>
  );
}

function buildErrorMessage(responseStatus: number, payload: unknown) {
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) {
    return `${parsed.data.error.code}: ${parsed.data.error.message}`;
  }
  return `사원정보를 불러오지 못했습니다. (${responseStatus})`;
}

export function ManagementSupportHrClient() {
  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<AdminUserProfileUpdateRequest>({
    fullName: "",
    email: "",
    employmentStatus: "active",
    reason: "사원 기본정보 수정",
  });
  const [profileSaveState, setProfileSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setErrorMessage(null);

    void fetch(appRoutes.admin.users, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(buildErrorMessage(response.status, payload));
        }

        const parsed = adminUsersListResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("사원정보를 불러오지 못했습니다.");
        }

        setItems(parsed.data.data.items);
        setSelectedUserId((current) => current ?? parsed.data.data.items[0]?.userId ?? null);
        setLoadState("loaded");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "사원정보를 불러오지 못했습니다.");
      });

    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => items.find((item) => item.userId === selectedUserId) ?? items[0] ?? null,
    [items, selectedUserId],
  );

  useEffect(() => {
    if (!selected) {
      return;
    }

    setProfileForm({
      fullName: selected.fullName,
      email: selected.email,
      employmentStatus: selected.employmentStatus,
      reason: "사원 기본정보 수정",
    });
    setProfileSaveState("idle");
    setProfileSaveMessage(null);
  }, [selected?.userId, selected?.fullName, selected?.email, selected?.employmentStatus]);

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    const parsedRequest = adminUserProfileUpdateRequestSchema.safeParse(profileForm);
    if (!parsedRequest.success) {
      setProfileSaveState("error");
      setProfileSaveMessage("이름, 이메일, 재직상태, 변경 사유를 확인해 주세요.");
      return;
    }

    setProfileSaveState("saving");
    setProfileSaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userProfile(selected.userId), {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사원 기본정보를 저장하지 못했습니다.");
      }

      const updatedUser = parsedResponse.data.data.user;
      setItems((current) => current.map((item) => (item.userId === updatedUser.userId ? updatedUser : item)));
      setSelectedUserId(updatedUser.userId);
      setProfileSaveState("saved");
      setProfileSaveMessage(`${updatedUser.fullName} 기본정보를 저장했습니다.`);
    } catch (error) {
      setProfileSaveState("error");
      setProfileSaveMessage(error instanceof Error ? error.message : "사원 기본정보를 저장하지 못했습니다.");
    }
  }

  const activeCount = items.filter((item) => item.employmentStatus === "active").length;
  const lockedCount = items.filter((item) => item.accountStatus === "locked").length;
  const offboardedCount = items.filter((item) => item.employmentStatus === "offboarded" || item.accountStatus === "offboarded").length;

  return (
    <div className="feature-workspace">
      <aside className="feature-workspace__nav" aria-label="인사관리 메뉴">
        <div className="feature-workspace__nav-header">
          <h1>인사관리</h1>
        </div>
        <div className="feature-workspace__tab-list" role="tablist" aria-label="인사관리 화면 선택">
          <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button">
            <span>사원정보관리</span>
          </button>
          <button aria-selected="false" className="feature-workspace__tab" disabled role="tab" type="button">
            <span>인사발령</span>
          </button>
          <button aria-selected="false" className="feature-workspace__tab" disabled role="tab" type="button">
            <span>휴면계정관리</span>
          </button>
        </div>
      </aside>

      <section className="feature-workspace__panel" aria-labelledby="support-employee-info-heading">
        <div className="feature-workspace__panel-header">
          <div>
            <h2 id="support-employee-info-heading">사원정보관리</h2>
          </div>
        </div>

        <div className="feature-workspace__status-grid" aria-label="사원정보관리 현황">
          <article className="feature-workspace__status feature-workspace__status--accent">
            <span>전체</span>
            <strong>{items.length}명</strong>
          </article>
          <article className="feature-workspace__status feature-workspace__status--accent">
            <span>재직</span>
            <strong>{activeCount}명</strong>
          </article>
          <article className="feature-workspace__status feature-workspace__status--warning">
            <span>잠금</span>
            <strong>{lockedCount}명</strong>
          </article>
          <article className="feature-workspace__status feature-workspace__status--warning">
            <span>퇴사</span>
            <strong>{offboardedCount}명</strong>
          </article>
        </div>

        {errorMessage ? (
          <aside className="feature-workspace__empty-state" role="alert" aria-label="사원정보관리 조회 오류">
            <strong>사원정보 조회 실패</strong>
            <p>{errorMessage}</p>
          </aside>
        ) : null}

        <form className="feature-workspace__form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>재직상태</span>
            <select defaultValue="전체" disabled>
              <option>전체</option>
              <option>재직</option>
              <option>휴직</option>
              <option>퇴사</option>
            </select>
          </label>
          <label>
            <span>검색</span>
            <input aria-label="사원명, 이메일, 부서 검색" readOnly value="" />
          </label>
          <div className="feature-workspace__actions">
            <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled type="button">
              조회
            </button>
            <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled type="button">
              사원 등록
            </button>
          </div>
        </form>

        <div className="employee-management-table-wrap" aria-label="사원 목록">
          <table className="employee-management-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>부서</th>
                <th>재직상태</th>
                <th>계정상태</th>
                <th>역할</th>
                <th>최근 로그인</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.userId}>
                  <td>
                    <button className="page-shell__title-link page-shell__title-button" onClick={() => setSelectedUserId(item.userId)} type="button">
                      {item.fullName}
                    </button>
                  </td>
                  <td>{item.email}</td>
                  <td>{item.departmentName}</td>
                  <td>{employmentStatusLabels[item.employmentStatus]}</td>
                  <td>{accountStatusLabels[item.accountStatus]}</td>
                  <td>{roleText(item.roleCodes)}</td>
                  <td>{formatDate(item.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && loadState !== "loading" ? (
          <aside className="feature-workspace__empty-state" aria-label="사원정보관리 빈 상태">
            <strong>조회된 사원이 없습니다</strong>
          </aside>
        ) : null}

        <div className="feature-workspace__rows" aria-label="사원정보관리 기능 항목 순서">
          {employeeInformationOrder.map((title, index) => (
            <article className="feature-workspace__row" key={title}>
              <div>
                <strong>{title}</strong>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
            </article>
          ))}
        </div>

        <form className="feature-workspace__form" onSubmit={handleProfileSave} aria-label="사원 기본정보 수정">
          <label>
            <span>이름</span>
            <input
              aria-label="사원 이름"
              disabled={!selected || profileSaveState === "saving"}
              onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
              value={profileForm.fullName}
            />
          </label>
          <label>
            <span>이메일</span>
            <input
              aria-label="사원 이메일"
              disabled={!selected || profileSaveState === "saving"}
              onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
              type="email"
              value={profileForm.email}
            />
          </label>
          <label>
            <span>재직상태</span>
            <select
              aria-label="사원 재직상태"
              disabled={!selected || profileSaveState === "saving"}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  employmentStatus: event.target.value as AdminUserProfileUpdateRequest["employmentStatus"],
                }))
              }
              value={profileForm.employmentStatus}
            >
              <option value="active">재직</option>
              <option value="on_leave">휴직</option>
              <option value="offboarded">퇴사</option>
            </select>
          </label>
          <label>
            <span>변경 사유</span>
            <input
              aria-label="사원 기본정보 변경 사유"
              disabled={!selected || profileSaveState === "saving"}
              onChange={(event) => setProfileForm((current) => ({ ...current, reason: event.target.value }))}
              value={profileForm.reason}
            />
          </label>
          <div className="feature-workspace__actions">
            <button className="touch-button feature-workspace__action" disabled={!selected || profileSaveState === "saving"} type="submit">
              {profileSaveState === "saving" ? "저장 중" : "기본정보 저장"}
            </button>
          </div>
          {profileSaveMessage ? (
            <p className="feature-workspace__save-message" role={profileSaveState === "error" ? "alert" : "status"}>
              {profileSaveMessage}
            </p>
          ) : null}
        </form>

        <EmployeeDetailSections selected={selected} />
      </section>
    </div>
  );
}
