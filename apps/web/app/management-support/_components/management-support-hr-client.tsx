"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  adminUsersListResponseSchema,
  appRoutes,
  errorResponseSchema,
  type AdminUserSummary,
  type RoleCode,
} from "@gw/shared";

const employeeInformationOrder = [
  { title: "사원 목록", meta: "01", status: "검색·필터·정렬" },
  { title: "사원 등록 / 계정 생성", meta: "02", status: "운영 DB 저장 연결" },
  { title: "사원 기본정보", meta: "03", status: "인사 실무 정보" },
  { title: "조직 / 지점 / 직무", meta: "04", status: "소속·직책·직급" },
  { title: "계정 / 역할 / 권한", meta: "05", status: "관리자페이지 계정관리와 연결" },
  { title: "보안 설정", meta: "06", status: "비밀번호·2단계 인증" },
  { title: "근무 / 재직 상태", meta: "07", status: "휴직·퇴사·비활성" },
  { title: "인사 서류 / 계약", meta: "08", status: "문서·계약 연결" },
  { title: "근태 / 휴가 연결", meta: "09", status: "요약·연결" },
  { title: "급여 연결", meta: "10", status: "요약·연결" },
  { title: "업무 접근 / 포털 접근", meta: "11", status: "포털 접근 확인" },
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
  unlinked: "사원 연결 필요",
  review_required: "연결 검토 필요",
};

const adminScopeLabels: Record<AdminUserSummary["adminScope"], string> = {
  global: "전체 관리 범위",
  company: "회사 관리 범위",
  audit: "감사 관리 범위",
};

const detailSectionBlueprint = [
  "기본정보",
  "조직 / 지점 / 직무",
  "계정 / 역할 / 권한",
  "보안 설정",
  "근무 / 재직 상태",
  "인사 서류 / 계약",
  "근태 / 휴가 연결",
  "급여 연결",
  "업무 접근 / 포털 접근",
] as const;

type EmployeeDetailSection = {
  title: string;
  meta: string;
  body: string;
  status: string;
  actionLabel?: string;
};

function buildEmployeeDetailSections(selected: AdminUserSummary | null): EmployeeDetailSection[] {
  if (!selected) {
    return detailSectionBlueprint.map((title) => ({
      title,
      meta: "선택 사원 조회 후 표시",
      body: "운영 DB 조회 결과에서 사원을 선택하면 실제 API 값 또는 연결 필요 상태를 표시합니다.",
      status: "대기",
    }));
  }

  return [
    {
      title: "기본정보",
      meta: `${selected.fullName} · ${selected.email}`,
      body: `${selected.departmentName} · ${employmentStatusLabels[selected.employmentStatus]}`,
      status: "운영 DB 조회",
      actionLabel: "기본정보 수정",
    },
    {
      title: "조직 / 지점 / 직무",
      meta: `부서: ${selected.departmentName}`,
      body: "지점, 직책, 직급, 사번, 입사일은 사원정보관리 전용 read API 연결 필요 상태입니다.",
      status: "부분 연결",
      actionLabel: "조직/직무 변경",
    },
    {
      title: "계정 / 역할 / 권한",
      meta: roleText(selected.roleCodes),
      body: `고위험 권한: ${selected.highRiskPermissions.length > 0 ? selected.highRiskPermissions.join(", ") : "없음"}`,
      status: accountStatusLabels[selected.accountStatus],
      actionLabel: "계정/권한 변경",
    },
    {
      title: "보안 설정",
      meta: selected.mustChangePassword ? "최초 로그인 비밀번호 변경 필요" : "비밀번호 변경 요구 없음",
      body: `${selected.twoFactorRequired ? "2단계 인증 필요" : "2단계 인증 미요구"} · 실패 ${selected.failedLoginCount}회 · 세션 ${selected.activeSessionCount}개`,
      status: "계정 보안",
      actionLabel: "보안 설정 변경",
    },
    {
      title: "근무 / 재직 상태",
      meta: employmentStatusLabels[selected.employmentStatus],
      body: `계정 상태: ${accountStatusLabels[selected.accountStatus]} · 최근 로그인: ${formatDate(selected.lastLoginAt)}`,
      status: "운영 DB 조회",
      actionLabel: "재직상태 변경",
    },
    {
      title: "인사 서류 / 계약",
      meta: "연결 필요",
      body: "근로계약서, 동의서, 증명서, 인사 발령 문서 조회 API가 아직 연결되지 않았습니다.",
      status: "미구성",
      actionLabel: "서류 등록",
    },
    {
      title: "근태 / 휴가 연결",
      meta: "연결 필요",
      body: "해당 사원의 근태·휴가 요약 read API가 아직 연결되지 않았습니다.",
      status: "미구성",
      actionLabel: "근태/휴가 열기",
    },
    {
      title: "급여 연결",
      meta: "연결 필요",
      body: "급여 대상 여부와 급여 요약은 민감정보 분리 후 별도 read API로 연결해야 합니다.",
      status: "미구성",
      actionLabel: "급여 연결 확인",
    },
    {
      title: "업무 접근 / 포털 접근",
      meta: `${adminScopeLabels[selected.adminScope]} · ${employeeLinkStatusLabels[selected.employeeLinkStatus]}`,
      body: "기본업무, 부서업무포털, 지점관리포털 접근 상세는 포털 접근 read API 연결 필요 상태입니다.",
      status: "부분 연결",
      actionLabel: "포털 접근 확인",
    },
  ];
}

function DisabledDetailAction({ label }: { label: string }) {
  return (
    <button
      aria-disabled="true"
      aria-label={`${label} — 실제 저장 API 연결 전까지 비활성 상태입니다.`}
      className="feature-workspace__row-action feature-workspace__row-action--secondary"
      disabled
      title="실제 저장 API 연결 전까지 비활성 상태입니다."
      type="button"
    >
      {label}
    </button>
  );
}

function EmployeeDetailSections({ selected }: { selected: AdminUserSummary | null }) {
  const sections = buildEmployeeDetailSections(selected);

  return (
    <div className="feature-workspace__rows" aria-label={selected ? `${selected.fullName} 사원 상세` : "사원 상세 섹션 기준"}>
      {sections.map((section) => (
        <article className="feature-workspace__row" key={section.title}>
          <div>
            <strong>{section.title}</strong>
            <span>{section.meta}</span>
            <p>{section.body}</p>
            {section.actionLabel ? (
              <div className="feature-workspace__row-actions" aria-label={`${section.title} 작업`}>
                <DisabledDetailAction label={section.actionLabel} />
              </div>
            ) : null}
          </div>
          <em>{section.status}</em>
        </article>
      ))}
      <article className="feature-workspace__row">
        <div>
          <strong>감사로그 연결</strong>
          <span>관리자페이지 감사로그에서 확인</span>
          <p>사원정보관리 상세 탭에는 변경이력을 두지 않습니다.</p>
          <div className="feature-workspace__row-actions" aria-label="감사로그 이동">
            <Link className="feature-workspace__row-action feature-workspace__row-action--secondary" href="/admin/audit-logs">감사로그 열기</Link>
          </div>
        </div>
        <em>관리자페이지</em>
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
          throw new Error("사원정보 응답 형식을 확인하지 못했습니다.");
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
          <p className="feature-workspace__permission-hint">
            사원정보관리 본기능은 경영지원팀 인사관리에서 다루고, 감사로그/변경이력은 관리자페이지 감사로그에서 확인합니다.
          </p>
        </div>

        <div className="feature-workspace__status-grid" aria-label="사원정보관리 현황">
          <article className="feature-workspace__status feature-workspace__status--accent">
            <span>전체</span>
            <strong>{items.length}명</strong>
            <p>{loadState === "loading" ? "운영 DB 조회 중" : "운영 DB 조회 기준"}</p>
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
            <p>운영 DB 조회 결과가 비어 있거나 현재 계정에 읽기 권한이 없습니다.</p>
          </aside>
        ) : null}

        <div className="feature-workspace__rows" aria-label="사원정보관리 기능 항목 순서">
          {employeeInformationOrder.map((row) => (
            <article className="feature-workspace__row" key={row.title}>
              <div>
                <strong>{row.title}</strong>
                <span>{row.meta}</span>
              </div>
              <em>{row.status}</em>
            </article>
          ))}
        </div>

        <EmployeeDetailSections selected={selected} />
      </section>
    </div>
  );
}
