"use client";

import React, { useMemo, useState } from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

type OrgEmployee = {
  id: string;
  name: string;
  position: string;
  role: string;
  status: "재직" | "휴가" | "외근";
  phone: string;
  email: string;
};

type OrgDepartment = {
  id: string;
  name: string;
  leader: string;
  summary: string;
  children?: readonly OrgDepartment[];
  employees: readonly OrgEmployee[];
};

// preview 전용 샘플 데이터입니다. 운영 DB seed나 API 응답으로 넣지 않고,
// 실제 조직 API 연결 시 이 상수만 제거/교체할 수 있게 page 내부에 격리합니다.
const orgPreviewDepartments: readonly OrgDepartment[] = [
  {
    id: "hq",
    name: "본사",
    leader: "강하늘 대표",
    summary: "전사 조직을 묶는 최상위 preview 노드입니다.",
    employees: [
      { id: "emp-ceo", name: "강하늘", position: "대표", role: "총괄", status: "재직", phone: "010-0000-1000", email: "ceo@example.com" },
    ],
    children: [
      {
        id: "strategy",
        name: "전략기획팀",
        leader: "윤서진 팀장",
        summary: "사업 계획과 전사 일정 조율을 담당하는 예시 부서입니다.",
        employees: [
          { id: "emp-yoon", name: "윤서진", position: "팀장", role: "기획", status: "재직", phone: "010-0000-1101", email: "yoon@example.com" },
          { id: "emp-han", name: "한지우", position: "매니저", role: "기획", status: "외근", phone: "010-0000-1102", email: "han@example.com" },
        ],
      },
      {
        id: "people",
        name: "인사운영팀",
        leader: "정하늘 팀장",
        summary: "인사, 근태, 휴가 운영을 담당하는 예시 부서입니다.",
        employees: [
          { id: "emp-jung", name: "정하늘", position: "팀장", role: "HR", status: "재직", phone: "010-0000-1201", email: "jung@example.com" },
          { id: "emp-kim", name: "김민수", position: "과장", role: "노무", status: "휴가", phone: "010-0000-1202", email: "kim@example.com" },
          { id: "emp-lee", name: "이서연", position: "대리", role: "채용", status: "재직", phone: "010-0000-1203", email: "lee@example.com" },
        ],
      },
      {
        id: "product",
        name: "제품개발팀",
        leader: "박지훈 책임",
        summary: "서비스 개발과 내부 도구 개선을 담당하는 예시 부서입니다.",
        employees: [
          { id: "emp-park", name: "박지훈", position: "책임", role: "개발", status: "재직", phone: "010-0000-1301", email: "park@example.com" },
          { id: "emp-choi", name: "최유진", position: "선임", role: "QA", status: "재직", phone: "010-0000-1302", email: "choi@example.com" },
        ],
      },
    ],
  },
  {
    id: "branch-seoul",
    name: "서울지점",
    leader: "오민재 지점장",
    summary: "지점 단위 조직 확인을 위한 preview 노드입니다.",
    employees: [
      { id: "emp-oh", name: "오민재", position: "지점장", role: "지점운영", status: "재직", phone: "010-0000-2101", email: "oh@example.com" },
      { id: "emp-seo", name: "서다인", position: "매니저", role: "고객지원", status: "재직", phone: "010-0000-2102", email: "seo@example.com" },
    ],
  },
] as const;

function flattenDepartments(departments: readonly OrgDepartment[]): OrgDepartment[] {
  return departments.flatMap((department) => [department, ...flattenDepartments(department.children ?? [])]);
}

function countDepartmentEmployees(department: OrgDepartment): number {
  return department.employees.length + (department.children ?? []).reduce((sum, child) => sum + countDepartmentEmployees(child), 0);
}

function getStatusTone(status: OrgEmployee["status"]): "accent" | "warning" | undefined {
  if (status === "재직") return "accent";
  if (status === "휴가") return "warning";
  return undefined;
}

export default function OrgPage() {
  const departments = useMemo(() => flattenDepartments(orgPreviewDepartments), []);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("people");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("emp-jung");
  const [keyword, setKeyword] = useState("");

  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId) ?? departments[0];
  const visibleEmployees = selectedDepartment.employees.filter((employee) => {
    const query = keyword.trim().toLowerCase();
    if (!query) return true;
    return [employee.name, employee.position, employee.role, employee.status, employee.email].some((value) => value.toLowerCase().includes(query));
  });
  const selectedEmployee = departments.flatMap((department) => department.employees).find((employee) => employee.id === selectedEmployeeId) ?? visibleEmployees[0] ?? selectedDepartment.employees[0];

  function renderDepartmentTree(items: readonly OrgDepartment[], depth = 0) {
    return items.map((department) => {
      const isSelected = department.id === selectedDepartment.id;
      return (
        <React.Fragment key={department.id}>
          <button
            className="org-tree-item"
            data-depth={depth}
            aria-current={isSelected ? "page" : undefined}
            onClick={() => {
              setSelectedDepartmentId(department.id);
              setSelectedEmployeeId(department.employees[0]?.id ?? "");
            }}
            type="button"
          >
            <span className="org-tree-item__name">{department.name}</span>
            <span className="org-tree-item__meta">{countDepartmentEmployees(department)}명</span>
          </button>
          {department.children?.length ? renderDepartmentTree(department.children, depth + 1) : null}
        </React.Fragment>
      );
    });
  }

  return (
    <PageShell
      eyebrow="조직도"
      title="조직도"
      description="부서 구조와 구성원을 한 화면에서 확인하는 조직도 preview입니다. 현재 샘플은 화면 확인용이며 운영 DB에 저장하지 않습니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">조직 구조</Pill>
          <Pill>preview sample</Pill>
        </div>
      }
    >
      <SurfaceSection title="조직도" description="부서 선택, 구성원 검색, 직원 상세 확인 흐름을 먼저 확인합니다.">
        <div className="org-preview-shell" aria-label="조직도 preview">
          <aside className="org-tree-panel" aria-label="부서 목록">
            <div className="org-panel-heading">
              <Pill tone="accent">부서</Pill>
              <h2>부서 목록</h2>
            </div>
            <div className="org-tree-list">{renderDepartmentTree(orgPreviewDepartments)}</div>
          </aside>

          <section className="org-member-panel" aria-label="구성원 목록">
            <div className="org-panel-heading org-panel-heading--row">
              <div>
                <Pill>{selectedDepartment.name}</Pill>
                <h2>{selectedDepartment.name} 구성원</h2>
                <p>{selectedDepartment.summary}</p>
              </div>
              <Pill>{selectedDepartment.leader}</Pill>
            </div>
            <label className="org-member-search">
              <span>구성원 검색</span>
              <input className="field" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="이름, 직급, 역할, 상태 검색" />
            </label>
            <div className="org-member-list">
              {visibleEmployees.map((employee) => (
                <button
                  key={employee.id}
                  className="org-member-row"
                  aria-current={employee.id === selectedEmployee?.id ? "page" : undefined}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  type="button"
                >
                  <span className="org-member-row__avatar" aria-hidden="true">{employee.name.slice(0, 1)}</span>
                  <span className="org-member-row__body">
                    <strong>{employee.name} {employee.position}</strong>
                    <small>{employee.role} · {employee.email}</small>
                  </span>
                  <Pill tone={getStatusTone(employee.status)}>{employee.status}</Pill>
                </button>
              ))}
              {!visibleEmployees.length ? <p className="card-note">검색 결과가 없습니다.</p> : null}
            </div>
          </section>

          <aside className="org-detail-panel" aria-label="직원 상세">
            <div className="org-panel-heading">
              <Pill tone="accent">직원 상세</Pill>
              <h2>{selectedEmployee?.name ?? "선택 없음"}</h2>
            </div>
            {selectedEmployee ? (
              <div className="org-detail-card">
                <div className="org-detail-avatar" aria-hidden="true">{selectedEmployee.name.slice(0, 1)}</div>
                <h3>{selectedEmployee.name} {selectedEmployee.position}</h3>
                <p>{selectedDepartment.name} · {selectedEmployee.role}</p>
                <div className="pill-row">
                  <Pill tone={getStatusTone(selectedEmployee.status)}>{selectedEmployee.status}</Pill>
                  <Pill>{selectedDepartment.leader}</Pill>
                </div>
                <dl className="org-detail-list">
                  <div>
                    <dt>연락처</dt>
                    <dd>{selectedEmployee.phone}</dd>
                  </div>
                  <div>
                    <dt>이메일</dt>
                    <dd>{selectedEmployee.email}</dd>
                  </div>
                  <div>
                    <dt>현재 부서</dt>
                    <dd>{selectedDepartment.name}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="card-note">직원을 선택하면 상세 정보가 표시됩니다.</p>
            )}
          </aside>
        </div>
      </SurfaceSection>

      <SurfaceSection title="이번 preview 범위" description="샘플 데이터는 화면 확인용으로만 사용하고, 운영 데이터 저장이나 권한 변경은 하지 않습니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <h3>포함</h3>
            <p>부서 트리, 부서별 구성원 목록, 구성원 검색, 직원 상세 preview.</p>
          </article>
          <article className="info-card">
            <h3>제외</h3>
            <p>운영 DB seed, 실데이터 변경, 조직 편집, 권한 변경, 인사 발령 저장.</p>
          </article>
          <article className="info-card">
            <h3>후속 교체 지점</h3>
            <p>실제 조직 API가 붙으면 화면 내부 preview 상수만 API 응답으로 바꾸면 됩니다.</p>
          </article>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
