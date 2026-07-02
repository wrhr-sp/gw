"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  listBranchesResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  type BranchSummary,
  type Department,
  type Employee,
  type EmployeeDirectorySummary,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;
type OrgData = { departments: Department[]; branches: BranchSummary[]; employees: Employee[]; summaries: EmployeeDirectorySummary[] };

const orgConfig = {
  title: "조직도",
  emptyActionLabel: "범위 확인",
};

const initialData: OrgData = { departments: [], branches: [], employees: [], summaries: [] };

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(route: string, parse: (payload: unknown) => T) {
  const response = await fetch(route, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parse(await response.json());
}

async function fetchOrgData(): Promise<OrgData> {
  const orgRoutes = appRoutes.org;
  const [departmentsResult, branchesResult, employeesResult] = await Promise.all([
    fetchJson(orgRoutes.departments, (payload) => {
      const parsed = listDepartmentsResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("부서 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
    fetchJson(orgRoutes.branches, (payload) => {
      const parsed = listBranchesResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("지점 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
    fetchJson(orgRoutes.employees, (payload) => {
      const parsed = listEmployeesResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("구성원 응답 형식이 계약과 맞지 않습니다.");
      return { employees: parsed.data.data.items, summaries: parsed.data.data.summaries };
    }),
  ]);
  return { departments: departmentsResult, branches: branchesResult, employees: employeesResult.employees, summaries: employeesResult.summaries };
}

const statusLabel = (employee: Employee, summaries: EmployeeDirectorySummary[]) => summaries.find((item) => item.employeeId === employee.id)?.statusLabel ?? (employee.employmentStatus === "on_leave" ? "휴가" : employee.employmentStatus === "offboarded" ? "퇴사" : "재직");
const roleLabel = (employee: Employee, summaries: EmployeeDirectorySummary[]) => summaries.find((item) => item.employeeId === employee.id)?.roleSummary ?? "구성원";
const noteLabel = (employee: Employee, summaries: EmployeeDirectorySummary[]) => summaries.find((item) => item.employeeId === employee.id)?.primaryNote ?? employee.email;

export default function OrgPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<OrgData>(initialData);
  const [toast, setToast] = useState<ToastState>(null);

  const activeDepartments = useMemo(() => data.departments.filter((department) => department.status === "active"), [data.departments]);
  const activeBranches = useMemo(() => data.branches.filter((branch) => branch.status === "active"), [data.branches]);
  const selectedDepartment = activeDepartments.find((department) => department.name.includes("인사")) ?? activeDepartments[0] ?? null;
  const selectedEmployees = useMemo(() => {
    if (!selectedDepartment) return data.employees;
    const scoped = data.employees.filter((employee) => employee.departmentId === selectedDepartment.id);
    return scoped.length > 0 ? scoped : data.employees;
  }, [data.employees, selectedDepartment]);

  async function reloadOrg() {
    setLoadState("loading");
    setToast(null);
    try {
      setData(await fetchOrgData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "조직 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadOrg(); }, []);

  return (
    <PageShell title="조직도" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="조직도 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadOrg()} type="button">{orgConfig.title}</button></h1>
            <FeaturePageOverflowMenu label="조직도" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="조직도 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>조직 트리</span><strong>부서</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>부서 상세</span><strong>인원</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>구성원</span><strong>목록</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>접근 범위</span><strong>권한</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="org-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="org-panel-heading">조직 트리</h2>
              <p>본사, 지점, 팀 단위를 실제 조직 API 기준으로 조회합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">조직 조회는 read-only이며 역할·정책 변경은 관리자 영역으로 분리합니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>본사</span><strong>{activeDepartments.length}개 팀</strong><p>조회 가능한 활성 부서</p></article>
            <article className="feature-workspace__status"><span>지점</span><strong>{activeBranches.length}곳</strong><p>현재 세션의 지점 범위</p></article>
            <article className="feature-workspace__status"><span>전체 인원</span><strong>{data.employees.length}명</strong><p>직원 API 조회 결과</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="조직 트리">
            {loadState === "loading" && activeDepartments.length === 0 ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>조직 트리 조회</span></div><em>대기</em></article> : null}
            {loadState !== "loading" && activeDepartments.length === 0 && activeBranches.length === 0 ? <article className="feature-workspace__row"><div><strong>표시할 조직 없음</strong><span>현재 조직 API에서 조회 가능한 부서나 지점이 없습니다.</span><div className="feature-workspace__row-actions" aria-label="조직 범위 확인"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">{orgConfig.emptyActionLabel}</button></div></div><em>empty</em></article> : null}
            {activeDepartments.map((department) => (
              <article className="feature-workspace__row" key={department.id}>
                <div><strong>{department.parentDepartmentId ? department.name : "본사"}</strong><span>{department.parentDepartmentId ? `${department.name} · ${department.code}` : activeDepartments.filter((item) => item.parentDepartmentId === department.id).map((item) => item.name).join(" · ") || department.name}</span><div className="feature-workspace__row-actions" aria-label={`${department.id} 부서 조회`}><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">부서 펼치기</button><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">구성원 보기</button></div></div><em>{department.status === "active" ? "펼침" : "중지"}</em>
              </article>
            ))}
            {activeBranches.map((branch) => <article className="feature-workspace__row" key={branch.id}><div><strong>{branch.name}</strong><span>{branch.branchType} · {branch.code}</span></div><em>확인</em></article>)}
          </div>

          <div className="feature-workspace__rows" aria-label="부서 상세와 구성원">
            <article className="feature-workspace__row"><div><strong>{selectedDepartment?.name ?? "선택된 부서 없음"}</strong><span>{selectedDepartment ? "근태 · 휴가 · 조직 정보 관리" : "조직 API 조회 결과를 기다립니다."}</span><p>{selectedDepartment ? "선택한 부서의 책임자, 구성원, 담당 업무를 보여 줍니다." : "부서가 없으면 샘플 부서로 채우지 않고 빈 상태를 유지합니다."}</p></div><em>{selectedDepartment ? "운영중" : "empty"}</em></article>
            {selectedEmployees.map((employee) => <article className="feature-workspace__row" key={employee.id}><div><strong>{employee.fullName}</strong><span>{roleLabel(employee, data.summaries)}</span><p>{noteLabel(employee, data.summaries)}</p></div><em>{statusLabel(employee, data.summaries)}</em></article>)}
            <article className="feature-workspace__row"><div><strong>접근 범위</strong><span>일반 직원은 필요한 연락·소속 정보만 보고, 민감 정보와 관리자 설정은 분리합니다.</span><p>표시할 조직이 없으면 회사 또는 지점 범위를 먼저 확인하고 조직 운영 변경은 관리자 화면에서 진행합니다.</p><div className="feature-workspace__row-actions" aria-label="조직 범위 확인"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">{orgConfig.emptyActionLabel}</button></div></div><em>권한</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
