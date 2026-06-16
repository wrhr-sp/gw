import React from "react";
import { appRoutes } from "@gw/shared";

import { PayrollOverviewLiveSection } from "../_components/phase35-live-sections";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const overviewCards = [
  {
    title: "급여 프로필 skeleton",
    summary: "직원별 지급 형태, 기준급/시급, 지급일, 적용 시작일을 한 자리에서 읽습니다.",
    detail: "프로필 저장/변경 확정 없이 기준 필드와 공개 범위만 먼저 맞춥니다.",
    href: appRoutes.payroll.overview,
  },
  {
    title: "급여 기간 / 마감 상태",
    summary: "월별 급여 기간을 collecting → reviewing → confirmed 흐름으로 구분합니다.",
    detail: "실정산 확정이 아니라 어떤 단계까지 왔는지 보여 주는 skeleton 입니다.",
    href: appRoutes.payroll.periodDetail("payroll_period_2026_05"),
  },
  {
    title: "내 급여명세서 초안",
    summary: "구성원은 본인 명세서 preview 와 정정 안내만 분리해서 봅니다.",
    detail: "동료 급여, 회사 총액, 실제 이체/신고 결과는 열지 않습니다.",
    href: "/payroll/me",
  },
] as const;

const roleCards = [
  {
    role: "본사 급여 담당",
    scope: "급여 프로필, 수당/공제 항목, 기간 상태, HQ 검토 게이트",
    note: "근태/휴가 입력을 받아 preview 초안을 만들고 최종 확정 전까지 read-only skeleton 으로 유지합니다.",
  },
  {
    role: "지점 관리자",
    scope: "지점 근태 마감, 수기 수당, 누락 자료 제출 상태",
    note: "다른 지점/회사 전체 급여 총액 상세는 숨기고 제출 책임 구간만 보여 줍니다.",
  },
  {
    role: "일반 직원",
    scope: "본인 명세서 초안, 정정 요청 안내, 공개 시점 안내",
    note: "본인 외 급여 데이터에는 접근하지 않으며, 실지급 확정 전에는 preview 문구를 고정합니다.",
  },
] as const;

const lineItemExamples = [
  "기본급 / 시급 / 일급 기준",
  "연장·야간·휴일 수당 preview",
  "식대·직책수당 같은 수기 allowance skeleton",
  "원천세 / 4대보험 placeholder deduction",
] as const;

const guardrails = [
  "실세액 계산, 4대보험 확정, 외부 신고/이체 연동은 이번 Phase 범위가 아닙니다.",
  "급여는 근태·휴가와 가까이 두되, 노무 grievance/징계와 같은 민감 이슈와는 별도 모듈로 분리합니다.",
  "구성원은 /payroll/me 에서 자기 명세서 초안만 확인하고 회사 전체 급여 상세는 보지 않습니다.",
] as const;

export default function PayrollPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 28A 급여 foundation pass 1"
      title="급여 skeleton"
      description="근태·휴가 다음 단계에서 급여 기초자료 수집, 지급 기간 상태, 명세서 초안을 분리해 읽는 독립 payroll 모듈 자리입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">attendance/leave input linked</Pill>
          <Pill>preview only</Pill>
          <Pill>role-split visibility</Pill>
        </div>
      }
    >
      <SurfaceSection title="실사용 급여 패널" description="급여 overview, 기간 상세, line item preview 를 실제 same-origin API 응답으로 먼저 확인합니다.">
        <PayrollOverviewLiveSection />
      </SurfaceSection>

      <SurfaceSection title="이번 Phase 에 먼저 여는 카드" description="실제 급여 계산 완료처럼 과장하지 않고 읽기 중심 구조를 먼저 맞춥니다.">
        <div className="grid-auto-compact">
          {overviewCards.map((card) => (
            <article key={card.title} className="route-card">
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="역할별 공개 범위" description="본사 급여 담당 / 지점 관리자 / 일반 직원이 보는 범위를 같은 화면에서 설명합니다.">
        <div className="grid-auto-compact">
          {roleCards.map((card) => (
            <article key={card.role} className="info-card">
              <Pill tone="accent">{card.role}</Pill>
              <strong>{card.scope}</strong>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="수당·공제 항목 skeleton" description="급여 line item 을 어디서 설명할지 먼저 고정합니다.">
        <ul className="summary-list">
          {lineItemExamples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="연결 API / 화면" description="same-origin API 와 직원 화면을 함께 확인합니다.">
        <ul className="summary-list">
          <li><a href={appRoutes.payroll.overview}>{appRoutes.payroll.overview}</a> — 급여 개요/기간/역할별 공개 범위</li>
          <li><a href={appRoutes.payroll.periodDetail("payroll_period_2026_05")}>{appRoutes.payroll.periodDetail("payroll_period_2026_05")}</a> — 기간 상세 / draft / line items</li>
          <li><a href={appRoutes.payroll.myPayslip}>{appRoutes.payroll.myPayslip}</a> — 본인 급여명세서 초안 API</li>
          <li><a href="/payroll/me">/payroll/me</a> — 구성원용 명세서 화면 skeleton</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="guardrail" description="급여 모듈에서 이번 단계에 하지 않는 일" muted>
        <ul className="summary-list">
          {guardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
