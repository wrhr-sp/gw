"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  listEmployeesResponseSchema,
  type Employee,
  type EmployeeDirectorySummary,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type EmployeeWithSummary = {
  employee: Employee;
  summary: EmployeeDirectorySummary | null;
};

const statusLabels: Record<Employee["employmentStatus"], string> = {
  active: "재직",
  on_leave: "휴가",
  offboarded: "퇴사",
};

const seedRows: EmployeeWithSummary[] = [
  {
    employee: { id: "seed-yun", companyId: "company_demo", departmentId: "department_strategy", email: "yun@example.com", fullName: "윤서진", employmentStatus: "active" },
    summary: { employeeId: "seed-yun", departmentName: "전략기획팀", roleSummary: "팀장", statusLabel: "재직", statusTone: "positive", primaryNote: "전략기획 업무 담당" },
  },
  {
    employee: { id: "seed-jung", companyId: "company_demo", departmentId: "department_hr", email: "jung@example.com", fullName: "정하늘", employmentStatus: "active" },
    summary: { employeeId: "seed-jung", departmentName: "인사운영팀", roleSummary: "팀장", statusLabel: "재직", statusTone: "positive", primaryNote: "근태·휴가 승인 담당자입니다." },
  },
  {
    employee: { id: "seed-kim", companyId: "company_demo", departmentId: "department_hr", email: "kim@example.com", fullName: "김민수", employmentStatus: "on_leave" },
    summary: { employeeId: "seed-kim", departmentName: "인사운영팀", roleSummary: "과장", statusLabel: "휴가", statusTone: "caution", primaryNote: "대체 연락 필요" },
  },
];

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchEmployeeRows(): Promise<EmployeeWithSummary[]> {
  const response = await fetch(appRoutes.org.employees, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = listEmployeesResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("직원 목록 응답 형식이 계약과 맞지 않습니다.");
  const summaries = new Map(parsed.data.data.summaries.map((summary) => [summary.employeeId, summary]));
  return parsed.data.data.items.map((employee) => ({ employee, summary: summaries.get(employee.id) ?? null }));
}

function EmployeeRow({ row }: { row: EmployeeWithSummary }) {
  const { employee, summary } = row;
  const departmentName = summary?.departmentName ?? employee.departmentId;
  const roleSummary = summary?.roleSummary ?? "직원";
  const statusLabel = summary?.statusLabel ?? statusLabels[employee.employmentStatus];
  return (
    <article className="feature-workspace__row">
      <div>
        <strong>{employee.fullName}</strong>
        <span>{`${departmentName} · ${roleSummary}`}</span>
        <p>{summary?.primaryNote ?? employee.email}</p>
        <div className="feature-workspace__row-actions" aria-label={`${employee.id} 직원 조회 처리`}>
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">프로필 보기</button>
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">조직도 위치</button>
        </div>
      </div>
      <em>{statusLabel}</em>
    </article>
  );
}

export default function EmployeesPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [rows, setRows] = useState<EmployeeWithSummary[]>(seedRows);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const activeCount = useMemo(() => rows.filter((row) => row.employee.employmentStatus === "active").length, [rows]);
  const leaveCount = useMemo(() => rows.filter((row) => row.employee.employmentStatus === "on_leave").length, [rows]);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.employee.fullName} ${row.employee.email} ${row.summary?.departmentName ?? ""} ${row.summary?.roleSummary ?? ""}`.toLowerCase().includes(term));
  }, [rows, search]);
  const selected = visibleRows[0] ?? rows[0] ?? null;

  async function reloadEmployees() {
    setLoadState("loading");
    setToast(null);
    try {
      const nextRows = await fetchEmployeeRows();
      setRows(nextRows);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "직원 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadEmployees(); }, []);

  return (
    <PageShell title="직원" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="직원 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadEmployees()} type="button">직원</button></h1>
            <FeaturePageOverflowMenu label="직원" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="직원 조회 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>직원 목록</span><strong>검색</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>직원 상세</span><strong>정보</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>근무 상태</span><strong>상태</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>권한 요청</span><strong>신청</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="employees-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="employees-panel-heading">직원 목록</h2>
              <p>부서, 이름, 직책, 근무 상태를 실제 직원 API 기준으로 조회합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">employee.read 기준의 조회 화면이며 계정 생성·권한 변경은 관리자 화면에서만 처리합니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>{toast.tone === "accent" ? "완료" : "확인"}</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>재직</span><strong>{activeCount}명</strong><p>현재 조회 가능한 재직자</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>휴가</span><strong>{leaveCount}명</strong><p>부재 또는 대체 연락 필요</p></article>
            <article className="feature-workspace__status"><span>외근</span><strong>0명</strong><p>상세 근태 API 연결 전에는 직원 기본 상태만 표시</p></article>
          </div>

          <form className="feature-workspace__form" onSubmit={(event) => event.preventDefault()}>
            <label><span>검색</span><input aria-label="직원 검색" onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 부서" value={search} /></label>
            <label><span>부서</span><select aria-label="부서 선택" disabled><option>전체 부서</option></select></label>
          </form>

          <div className="feature-workspace__rows" aria-label="직원 목록">
            {loadState === "loading" && rows.length === 0 ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>직원 목록 조회</span></div><em>대기</em></article> : null}
            {visibleRows.length === 0 ? <article className="feature-workspace__row"><div><strong>조회 가능한 직원이 없으면</strong><span>검색어와 부서 범위를 확인하고, 권한이 필요한 정보는 관리자에게 요청합니다.</span><div className="feature-workspace__row-actions" aria-label="직원 검색 초기화"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSearch("")} type="button">검색 초기화</button></div></div><em>권한 요청</em></article> : visibleRows.map((row) => <EmployeeRow key={row.employee.id} row={row} />)}
          </div>

          <div className="feature-workspace__rows" aria-label="직원 상세">
            {selected ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>{selected.employee.fullName}</strong>
                  <span>{`${selected.summary?.departmentName ?? selected.employee.departmentId} · ${selected.summary?.roleSummary ?? "직원"}`}</span>
                  <p>{selected.summary?.primaryNote ?? "업무에 필요한 소속, 직책, 연락 가능 상태만 먼저 보여 줍니다."}</p>
                  <div className="feature-workspace__row-actions" aria-label="직원 상세 보조 동작">
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">메신저 보내기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">조직에서 보기</button>
                  </div>
                </div>
                <em>{selected.summary?.statusLabel ?? statusLabels[selected.employee.employmentStatus]}</em>
              </article>
            ) : null}
            <article className="feature-workspace__row"><div><strong>권한 요청</strong><span>보이지 않는 관리 기능은 권한 요청으로 연결하고, 임의 접근은 차단합니다.</span><p>관리자 권한 변경은 담당 승인 후 적용합니다. 민감 정보는 권한이 없으면 화면에 표시하지 않습니다.</p></div><em>신청</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
