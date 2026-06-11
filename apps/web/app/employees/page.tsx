import React from "react";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const employeeCards = [
  {
    name: "운영 매니저",
    department: "운영팀",
    roleSummary: "MANAGER · 팀 운영",
    status: "재직",
    note: "조직/업무 맥락 확인용 기본 조회",
  },
  {
    name: "인사 코디네이터",
    department: "인사팀",
    roleSummary: "MANAGER · 운영 지원",
    status: "휴직/부재",
    note: "민감 권한 구분 없이 상태와 소속만 먼저 노출",
  },
  {
    name: "일반 구성원",
    department: "운영팀",
    roleSummary: "EMPLOYEE · 일반 구성원",
    status: "재직",
    note: "작은 화면에서도 한 줄 요약이 먼저 보이도록 유지",
  },
] as const;

const filterChips = ["부서", "재직 상태", "역할/직책"] as const;
const boundaryNotes = [
  "이 화면은 직원을 찾고 상태를 이해하는 일반 조회 화면입니다.",
  "관리자 변경 검토는 /admin/users 에서 분리해 다룹니다.",
  "개인정보 상세 편집, 초대 기능, 권한 변경 저장은 이번 범위가 아닙니다.",
] as const;

export default function EmployeesPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 11 조직/직원 일반 화면 1차"
      title="직원 목록 / 상태 조회 skeleton"
      description="일반 업무 화면에서 직원 이름, 소속, 역할/직책 요약, 재직 상태를 읽기 쉽게 보여 주는 dev-safe placeholder 입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">general lookup</Pill>
          <Pill>small-screen readable</Pill>
        </div>
      }
    >
      <SurfaceSection title="이 화면의 역할" description="관리자 운영 화면과 섞이지 않도록 일반 조회 범위를 먼저 고정합니다.">
        <ul className="bullet-list">
          {boundaryNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="필터 후보" description="작은 화면에서는 긴 표보다 짧은 chip/카드 흐름을 우선합니다." muted>
        <div className="pill-row">
          {filterChips.map((item) => (
            <Pill key={item}>{item}</Pill>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="직원 목록" description="모바일에서도 읽기 쉬운 카드형 기본안을 먼저 고정합니다.">
        <div className="mobile-summary-grid">
          {employeeCards.map((employee) => (
            <article key={employee.name} className="route-card">
              <div className="pill-row">
                <Pill tone={employee.status === "재직" ? "accent" : "warning"}>{employee.status}</Pill>
                <Pill>{employee.department}</Pill>
              </div>
              <h3>{employee.name}</h3>
              <p>{employee.roleSummary}</p>
              <p>{employee.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="연결 API / 안내" description="실데이터 변경 없이 읽기 응답과 안내 문구만 맞춥니다.">
        <ul className="summary-list">
          <li>
            <a href={appRoutes.org.employees}>{appRoutes.org.employees}</a> — 직원 목록과 상태 요약
          </li>
          <li>
            <a href={appRoutes.org.departments}>{appRoutes.org.departments}</a> — 부서 필터 후보
          </li>
          <li>
            <a href="/admin/users">/admin/users</a> — 운영 사용자/권한 검토 분리 경로
          </li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
