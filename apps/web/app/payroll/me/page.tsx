import React from "react";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";

const summaryCards = [
  {
    label: "지급 기간",
    value: "2026년 5월 급여",
    note: "본사 검토 완료 전까지 preview 로만 표시됩니다.",
  },
  {
    label: "예상 실수령",
    value: "2,183,400원",
    note: "원천세/4대보험은 placeholder 추정치입니다.",
  },
  {
    label: "공개 상태",
    value: "reviewing / 직원 공개 대기",
    note: "급여 확정 전에는 문의 안내만 노출합니다.",
  },
] as const;

const lineItems = [
  { label: "기본 근무시간", amount: "2,150,400원", note: "168시간 × 시급 preview" },
  { label: "연장근로 수당", amount: "172,800원", note: "9시간 premium preview" },
  { label: "야간근로 수당", amount: "38,400원", note: "야간 premium preview" },
  { label: "식대", amount: "120,000원", note: "지점 수기 allowance placeholder" },
  { label: "원천세 placeholder", amount: "-187,000원", note: "실세액 엔진 미연동" },
  { label: "4대보험 placeholder", amount: "-140,000원", note: "보험 계산 미연동" },
] as const;

const guidance = [
  "급여명세서 초안과 실제 지급 확정값을 같은 말로 표시하지 않습니다.",
  "근태/휴가 정정이 필요하면 급여 확정 전에 먼저 관련 화면과 담당자 안내를 확인합니다.",
  "동료 명세서 조회, 통장 이체 결과, 세무 신고 제출은 이번 화면에 넣지 않습니다.",
] as const;

export default function PayrollMePage() {
  return (
    <PageShell
      backHref="/payroll"
      backLabel="급여 허브로"
      eyebrow="Phase 28A employee payslip preview"
      title="내 급여명세서 초안"
      description="구성원은 본인 급여명세서 preview 와 정정 안내만 확인합니다. 실지급 확정, 동료 급여 조회, 외부 신고 결과는 보여 주지 않습니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">self-only</Pill>
          <Pill>preview amount</Pill>
          <Pill>correction guidance</Pill>
        </div>
      }
    >
      <SurfaceSection title="한눈에 보는 요약" description="직원 화면에서 가장 먼저 보는 정보만 짧게 둡니다.">
        <div className="grid-auto-compact">
          {summaryCards.map((card) => (
            <article key={card.label} className="stat-card">
              <p className="meta-copy">{card.label}</p>
              <h3>{card.value}</h3>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="지급/공제 항목 preview" description="실제 계산 엔진이 아니라 항목 구조와 공개 방식만 먼저 맞춥니다.">
        <div className="grid-auto-compact">
          {lineItems.map((item) => (
            <article key={item.label} className="info-card">
              <strong>{item.label}</strong>
              <p>{item.amount}</p>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="정정 안내 / 연결 API" description="정정은 급여 확정 전에 관련 입력 소스를 먼저 확인하도록 안내합니다.">
        <ul className="summary-list">
          <li><a href={appRoutes.payroll.myPayslip}>{appRoutes.payroll.myPayslip}</a> — 본인 급여명세서 초안 API</li>
          <li><a href={appRoutes.attendance.records}>{appRoutes.attendance.records}</a> — 근태 기록 확인</li>
          <li><a href={appRoutes.leave.balances}>{appRoutes.leave.balances}</a> — 휴가 잔여/반영 확인</li>
          <li><a href={appRoutes.payroll.periodDetail("payroll_period_2026_05")}>{appRoutes.payroll.periodDetail("payroll_period_2026_05")}</a> — 기간 상세 preview</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="쉬운 말 안내" description="직원용 화면에서 혼동을 줄이기 위한 고정 문구입니다." muted>
        <ul className="summary-list">
          {guidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
