import React from "react";
import { appRoutes } from "@gw/shared";

import { leavePolicySummaryPreview, leaveTypeCodeLabels } from "../../admin-skeleton-config";
import { PlaceholderAction } from "../_components/placeholder-action";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { LeaveLiveSection } from "../_components/real-usage-panels";

const leaveTypes = leavePolicySummaryPreview.allowedLeaveTypeCodes.map((code) => ({
  code,
  name: leaveTypeCodeLabels[code as keyof typeof leaveTypeCodeLabels],
  unit: code === "half_day_am" ? "half_day" : "day",
  note: code === "annual" ? "기본 연차 placeholder" : code === "half_day_am" ? "반일 사용 예시" : "증빙/정책 엔진은 후속 Phase",
}));

const balances = [
  { type: "연차", opening: 15, used: 3, reserved: 1, remaining: 11 },
  { type: "병가", opening: 10, used: 0, reserved: 0, remaining: 10 },
] as const;

const approvals = [
  { employee: "관리자 테스트", period: "2026-06-20", type: "연차", status: "pending", note: "인수인계 계획 확인 필요" },
  { employee: "운영 매니저", period: "2026-06-21 오전", type: "반차", status: "pending", note: "대체 근무자 확인 필요" },
] as const;

const requesterLane = [
  "1. 허용된 휴가 유형과 현재 잔여를 먼저 확인합니다.",
  "2. 신청 기간·사유를 입력하고 신청 preview 를 올립니다.",
  "3. 내 신청 상태와 승인/반려 결과를 같은 화면에서 다시 확인합니다.",
] as const;

const approverLane = [
  "승인 권한자만 승인 대기열을 보고 approve/reject 문맥을 확인합니다.",
  "일반 직원은 승인 버튼 대신 내 신청과 잔여 snapshot 중심으로 제한합니다.",
  "자기 휴가 자기승인, forged/unknown request id, 회사 scope 밖 요청은 성공처럼 처리하지 않습니다.",
] as const;

const stateAxisCards = [
  {
    tone: "accent" as const,
    title: "권한 부족",
    body: "leave.approve 권한이 없으면 승인 대기 대신 내 신청과 잔여 조회만 유지합니다.",
  },
  {
    tone: "warning" as const,
    title: "정책 미허용",
    body: "허용되지 않은 휴가 유형, 잔여 부족, 예외 검토 필요 상태를 승인자 lane 과 섞지 않고 따로 설명합니다.",
  },
  {
    tone: "default" as const,
    title: "회사 scope 차단",
    body: "다른 회사 요청이나 unknown request id 는 접근/승인 성공처럼 보이지 않게 유지합니다.",
  },
  {
    tone: "warning" as const,
    title: "placeholder 제한",
    body: "실제 급여/정산 반영, 조직 master 자동 차감, production 인사 운영 반영은 이번 단계 범위 밖입니다.",
  },
] as const;

const policyBridgeNotes = [
  "권한 부족: leave.approve 권한이 없으면 승인 대기함 대신 내 신청과 잔여 snapshot 중심으로 제한합니다.",
  "회사 scope: 팀장 승인도 같은 회사 요청만 검토하고 다른 회사 요청으로 확장하지 않습니다.",
  `허용 유형: ${leavePolicySummaryPreview.allowedLeaveTypeCodes.map((code) => leaveTypeCodeLabels[code as keyof typeof leaveTypeCodeLabels]).join(", ")}만 직원 화면에 노출합니다.`,
  "정책상 미허용/예외 검토: 휴가 유형, 승인 필요 여부, 대체 근무자 기준을 /admin/policies 와 같은 말로 설명합니다.",
  "placeholder 제한: 실제 차감, 급여 반영, 증빙 저장은 열지 않고 review candidate 만 유지합니다.",
] as const;

export default function LeavePage() {
  return (
    <PageShell
      eyebrow="Phase 42 휴가 기본 업무 도입"
      title="휴가"
      titleHref="/leave"
      description="직원이 잔여 확인 → 신청 → 상태 확인으로 바로 이어가고, 승인자 lane 은 따로 분리해 same-origin API 기준 preview 를 직접 눌러볼 수 있게 정리했습니다."
      actions={
        <div className="action-row">
          <PlaceholderAction label="휴가 신청 바로 확인" hint="온라인에서 신청 preview 를 눌러 잔여 확인 → 신청 → 상태 확인 순서를 먼저 따라갑니다." />
          <PlaceholderAction label="승인 대기 레인 보기" hint="승인 권한자만 승인 대기 문맥을 확인하고, 일반 직원은 내 신청 상태 중심으로 제한합니다." tone="secondary" />
        </div>
      }
    >
      <SurfaceSection title="실사용 확인 패널" description="잔여/요청 목록을 실제 API에서 읽고, 신청·승인·반려 preview 를 바로 테스트합니다.">
        <LeaveLiveSection />
      </SurfaceSection>

      <SurfaceSection title="신청자 happy path" description="일반 직원이 지금 바로 따라갈 수 있는 휴가 사용 순서를 짧게 고정합니다.">
        <ol className="number-list">
          {requesterLane.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="승인자 lane / self-approval 차단" description="승인자 확인 레인과 일반 직원 레인을 하나의 문장으로 섞지 않습니다.">
        <ul className="summary-list">
          {approverLane.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="휴가 유형과 잔여 요약" description="모바일에서는 잔여 snapshot 을 카드형으로 먼저 읽습니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">회사 기본 설정 기준</Pill>
            <p>{leavePolicySummaryPreview.effectiveScopeLabel}</p>
            <p className="card-note">{leavePolicySummaryPreview.employeeMessage}</p>
          </article>
          <article className="info-card">
            <Pill>승인 노출 규칙</Pill>
            <p>{leavePolicySummaryPreview.managerMessage}</p>
            <p className="card-note">승인 대기열: {leavePolicySummaryPreview.approvalQueueVisibleToApprover ? "승인 권한자에게만 노출" : "비노출"}</p>
          </article>
        </div>

        <div className="grid-auto" style={{ marginTop: 16 }}>
          {leaveTypes.map((item) => (
            <article key={item.code} className="info-card">
              <Pill>{item.code}</Pill>
              <h3>{item.name}</h3>
              <p>단위: {item.unit}</p>
              <p>{item.note}</p>
            </article>
          ))}
        </div>

        <div className="mobile-record-list" style={{ display: "grid", marginTop: 16 }}>
          {balances.map((row) => (
            <article key={row.type} className="record-card">
              <strong>{row.type}</strong>
              <span>기초 {row.opening} · 사용 {row.used}</span>
              <span>예약 {row.reserved} · 잔여 {row.remaining}</span>
            </article>
          ))}
        </div>

        <div className="horizontal-scroll" style={{ marginTop: 16 }}>
          <table className="responsive-table">
            <thead>
              <tr>
                <th>유형</th>
                <th>기초</th>
                <th>사용</th>
                <th>예약</th>
                <th>잔여</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.type}>
                  <td>{row.type}</td>
                  <td>{row.opening}</td>
                  <td>{row.used}</td>
                  <td>{row.reserved}</td>
                  <td>{row.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="link-row" style={{ marginTop: 16 }}>
          <a href={appRoutes.leave.types}>{appRoutes.leave.types}</a>
          <a href={appRoutes.leave.balances}>{appRoutes.leave.balances}</a>
        </div>
      </SurfaceSection>

      <SurfaceSection title="차단 이유 4축" description="권한 부족, 정책 미허용, 회사 scope, placeholder 제한을 같은 축으로 유지합니다.">
        <div className="grid-auto-compact">
          {stateAxisCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone={card.tone}>{card.title}</Pill>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="휴가 신청 입력 예시" description="필드 순서를 줄이고 입력 부담을 최소화한 모바일 1차 구조입니다.">
        <div className="field-grid">
          <input disabled value="leave_type_annual" readOnly className="field" />
          <input disabled value="2026-06-20" readOnly className="field" />
          <input disabled value="2026-06-20" readOnly className="field" />
          <input disabled value="1 day" readOnly className="field" />
        </div>
        <textarea disabled rows={4} className="textarea-field" defaultValue="가족 행사" style={{ marginTop: 12 }} />
        <ul className="summary-list" style={{ marginTop: 16 }}>
          <li><a href={appRoutes.leave.requests}>{appRoutes.leave.requests}</a> — 조회/신청 skeleton</li>
          <li>잔여 값은 자동 계산 확정본이 아니라 snapshot placeholder 입니다.</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="운영 정책 연결 메모" description="일반 구성원, 팀장 승인자, HR 운영자가 같은 이유를 같은 표현으로 읽도록 맞춥니다." muted>
        <ul className="summary-list">
          {policyBridgeNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="승인 / 반려 대기 예시" description="긴 목록 대신 카드형 대기 상태를 먼저 보여 줍니다." muted>
        <div className="mobile-summary-grid">
          {approvals.map((row) => (
            <article key={`${row.employee}-${row.period}`} className="info-card">
              <Pill tone="warning">{row.status}</Pill>
              <strong>{row.employee}</strong>
              <p>{row.type} / {row.period}</p>
              <p>{row.note}</p>
            </article>
          ))}
        </div>
        <ul className="summary-list" style={{ marginTop: 16 }}>
          <li><a href={appRoutes.leave.approve("leave_request_demo")}>{appRoutes.leave.approve("leave_request_demo")}</a></li>
          <li><a href={appRoutes.leave.reject("leave_request_demo")}>{appRoutes.leave.reject("leave_request_demo")}</a></li>
          <li>민감한 실제 사유 전문과 증빙 파일은 placeholder 범위에서 마스킹/미연결 상태를 유지합니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
