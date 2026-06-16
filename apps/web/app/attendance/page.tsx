import React from "react";
import { appRoutes } from "@gw/shared";

import { PlaceholderAction } from "../_components/placeholder-action";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { AttendanceLiveSection } from "../_components/real-usage-panels";
import { employeeAttendanceEffectivePolicy, attendanceRegistrationMethodLabels, getAttendancePagePolicyView } from "../../admin-skeleton-config";
import { offlineGuidance } from "../mobile-pwa-config";

const todaySummary = [
  { label: "직원 happy path", value: "출근 → 오늘 상태 확인 → 퇴근 → 정정 요청", note: "근태 화면 하나에서 오늘 업무 순서를 바로 따라가게 정리합니다." },
  { label: "승인자 확인", value: "예외 기록과 정정 요청 검토", note: "직원용 흐름과 승인 처리 책임을 한 카드로 섞지 않습니다." },
  { label: "승인 게이트", value: "GPS · 장비 · 급여 반영은 별도 승인", note: "실운영 장비·위치정보·정산 연동은 이번 단계 완료 범위가 아닙니다." },
] as const;

const recordRows = [
  { workDate: "2026-06-10", status: "checked_out", checkInAt: "09:00", checkOutAt: "18:00", note: "정상 퇴근 예시" },
  { workDate: "2026-06-09", status: "needs_correction", checkInAt: "09:05", checkOutAt: "-", note: "퇴근 누락 → 정정 요청 후보" },
] as const;

const filters = [
  { label: "기간", placeholder: "2026-06-01 ~ 2026-06-30" },
  { label: "직원", placeholder: "관리 권한이 있으면 employee_id 기준 조회 확장" },
] as const;

const dayFlowSteps = [
  {
    title: "1. 출근 등록",
    body: "현재 정책에서 허용된 방식으로만 출근 버튼을 노출합니다. 허용되지 않은 방식은 성공처럼 보이지 않고 정책 미허용으로 분리합니다.",
  },
  {
    title: "2. 오늘 상태 확인",
    body: "오늘 기록, 현재 상태, 최근 누락/예외를 먼저 보고 다음 액션을 정합니다. 작은 화면에서도 표보다 카드형 상태를 우선으로 보여 줍니다.",
  },
  {
    title: "3. 퇴근 또는 정정 요청",
    body: "퇴근은 온라인에서만 다시 시도하고, 누락/오류는 본인 범위 정정 요청으로 이어집니다. 승인 처리는 직원 CTA 와 분리해 설명합니다.",
  },
] as const;

const approvalLane = [
  "일반 직원: 오늘 상태 확인, 허용 방식 확인, 본인 기록 정정 요청",
  "팀장/인사 승인자: 예외 기록 확인, 정정 요청 검토, 회사 scope 밖 기록 차단 유지",
  "운영 관리자: /admin/policies 에서 정책 source 와 허용 방식 기준 비교",
] as const;

const guardrailCards = [
  {
    tone: "accent" as const,
    title: "권한 부족",
    body: "승인 권한이 없는 사용자는 다른 직원 기록 처리나 승인 액션을 열지 않습니다.",
  },
  {
    tone: "warning" as const,
    title: "정책 미허용",
    body: "현재 소속 정책에서 허용하지 않은 등록 방식은 바로 차단하고 허용 방식만 다시 안내합니다.",
  },
  {
    tone: "default" as const,
    title: "회사 scope 차단",
    body: "다른 회사 employee_id, forged/unknown 기록 id 는 성공처럼 처리하지 않습니다.",
  },
  {
    tone: "warning" as const,
    title: "placeholder 제한",
    body: "GPS, NFC/RFID/QR, 실급여 반영, 실정산 연결은 계속 승인 게이트로 남깁니다.",
  },
] as const;

const attendancePolicyView = getAttendancePagePolicyView(employeeAttendanceEffectivePolicy);
const allowedAttendanceMethods = attendancePolicyView.allowedMethods;
const supportsTagSkeleton = attendancePolicyView.showTagSkeleton;

export default function AttendancePage() {
  return (
    <PageShell
      eyebrow="Phase 42 근태 기본 업무 도입"
      title="근태"
      description="직원이 하루를 시작할 때 바로 따라갈 순서와 승인자 검토 레인을 분리해 보여 주고, same-origin API 응답으로 출근/퇴근/정정 요청 preview 를 직접 확인할 수 있게 정리했습니다."
      actions={
        <div className="action-row">
          {allowedAttendanceMethods.includes("mobile") ? (
            <PlaceholderAction label="모바일 출근 등록" hint="모바일/PWA 버튼으로 허용된 등록 방식입니다. placeholder 단계에서는 실제 출근 기록을 남기지 않습니다." />
          ) : null}
          {allowedAttendanceMethods.includes("pc") ? (
            <PlaceholderAction
              label="PC 출근 등록"
              hint="데스크톱/웹에서 허용된 등록 방식입니다. 온라인 연결과 서버 검증이 가능할 때만 실제 퇴근 등록을 허용합니다."
              tone="secondary"
            />
          ) : null}
        </div>
      }
    >
      <SurfaceSection title="실사용 확인 패널" description="근태 기록 조회, 출근/퇴근, 정정 요청 preview 를 같은 화면에서 바로 확인합니다.">
        <AttendanceLiveSection />
      </SurfaceSection>

      <SurfaceSection title="오늘 바로 따라갈 순서" description="정책 설명보다 먼저 직원 기준 하루 흐름을 짧은 stepper 로 보여 줍니다.">
        <div className="grid-auto">
          {dayFlowSteps.map((step) => (
            <article key={step.title} className="route-card">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="직원 / 승인자 / 운영자 레인 분리" description="같은 근태 모듈 안에서도 누가 무엇을 직접 해볼 수 있는지 책임을 나눠 적습니다.">
        <ul className="summary-list">
          {approvalLane.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="현재 나에게 적용된 출퇴근 정책" description="회사 기본이 아니라 내 근무지/부서/직무까지 계산한 effective policy 기준으로 안내합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">effective policy</Pill>
            <strong>{attendancePolicyView.policySummary}</strong>
            <p>허용 방식: {attendancePolicyView.allowedMethodLabels.join(", ")}</p>
          </article>
          {!allowedAttendanceMethods.includes("mobile") || !allowedAttendanceMethods.includes("pc") ? (
            <article className="info-card">
              <Pill tone="warning">method restricted</Pill>
              <p>모바일/PC 등록은 현재 소속 정책에서 허용되지 않습니다.</p>
              <p>허용된 방식만 CTA 와 API 검증 대상으로 유지합니다.</p>
            </article>
          ) : null}
        </div>
      </SurfaceSection>

      <SurfaceSection title="오늘 바로 써야 하는 카드" description="상태와 마지막 기록을 표보다 먼저 보여 줍니다.">
        <div className="grid-auto">
          {todaySummary.map((card) => (
            <article key={card.label} className="stat-card">
              <p className="meta-copy">{card.label}</p>
              <h3>{card.value}</h3>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="현재 허용 출퇴근 방식" description="effective policy 에서 허용한 방식만 CTA 와 안내로 보여 줍니다.">
        <div className="grid-auto-compact">
          {allowedAttendanceMethods.map((method) => (
            <article key={method} className="info-card">
              <Pill tone="accent">현재 허용 방식</Pill>
              <strong>{attendanceRegistrationMethodLabels[method]}</strong>
              <p>
                {method === "mobile"
                  ? "모바일/PWA에서 바로 등록합니다."
                  : method === "pc"
                    ? "PC/웹에서 출퇴근을 등록합니다."
                    : "태그 단말 안내 기준으로만 노출하며 실장비 연동 완료처럼 보이지 않게 유지합니다."}
              </p>
            </article>
          ))}
          {supportsTagSkeleton ? (
            <article className="info-card">
              <Pill tone="warning">tag skeleton</Pill>
              <strong>태그 단말 연동 예정</strong>
              <p>태그 단말 연동은 별도 승인 후 연결합니다. 이번 단계에서는 안내와 검증 지점만 고정합니다.</p>
            </article>
          ) : null}
        </div>
      </SurfaceSection>

      <SurfaceSection title="차단 이유 4축" description="권한 부족, 정책 미허용, 회사 scope, placeholder 제한을 같은 축으로 계속 유지합니다.">
        <div className="grid-auto-compact">
          {guardrailCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone={card.tone}>{card.title}</Pill>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="온라인 전용 상태 변경 안내" description="이번 Phase 에서는 offline 상태에서 성공처럼 보이는 UX 를 만들지 않습니다." muted>
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="warning">blocked offline</Pill>
            <p>{offlineGuidance.blockedNow[0]}</p>
            <p>{offlineGuidance.blockedNow[1]}</p>
          </article>
          <article className="info-card">
            <Pill tone="accent">retry steps</Pill>
            <ul className="summary-list">
              {offlineGuidance.retrySteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="필터와 최근 기록" description="모바일에서는 카드형 기록을 기본으로 보고, 큰 화면에서만 표를 함께 보여 줍니다.">
        <div className="field-grid">
          {filters.map((filter) => (
            <label key={filter.label} className="form-placeholder">
              <strong>{filter.label}</strong>
              <input disabled value={filter.placeholder} className="field" readOnly />
            </label>
          ))}
        </div>

        <div className="mobile-record-list" style={{ marginTop: 16 }}>
          {recordRows.map((row) => (
            <article key={row.workDate} className="record-card">
              <Pill>{row.status}</Pill>
              <strong>{row.workDate}</strong>
              <span>출근 {row.checkInAt} · 퇴근 {row.checkOutAt}</span>
              <span className="muted-copy">{row.note}</span>
            </article>
          ))}
        </div>

        <div className="horizontal-scroll" style={{ marginTop: 16 }}>
          <table className="responsive-table">
            <thead>
              <tr>
                <th>근무일</th>
                <th>상태</th>
                <th>출근</th>
                <th>퇴근</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {recordRows.map((row) => (
                <tr key={row.workDate}>
                  <td>{row.workDate}</td>
                  <td>{row.status}</td>
                  <td>{row.checkInAt}</td>
                  <td>{row.checkOutAt}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceSection>

      <SurfaceSection title="지금 바로 눌러볼 route" description="실사용 UAT 중 가장 먼저 다시 확인할 API/route 만 짧게 연결합니다.">
        <ul className="summary-list">
          <li><a href={appRoutes.attendance.records}>{appRoutes.attendance.records}</a> — 최근 기록과 현재 정책 source 확인</li>
          <li><a href={appRoutes.attendance.corrections}>{appRoutes.attendance.corrections}</a> — 본인 범위 정정 요청 생성 preview</li>
          <li><a href="/admin/policies">/admin/policies</a> — 일반 화면 설명과 운영 정책 source 비교</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="정정 요청 placeholder" description="requested_by / reviewed_by / reviewed_at contract 를 먼저 맞춥니다.">
        <div className="form-placeholder">
          <input disabled value="attendance_record_today" readOnly className="field" />
          <textarea disabled rows={4} className="textarea-field" defaultValue="퇴근 시간이 누락되었습니다. / QR 체크아웃 누락" />
        </div>
        <ul className="summary-list" style={{ marginTop: 16 }}>
          <li><a href={appRoutes.attendance.corrections}>{appRoutes.attendance.corrections}</a> — 정정 요청 생성 skeleton</li>
          <li>민감한 실제 위치/GPS/기기 식별 값은 placeholder 단계에서 저장·노출하지 않습니다.</li>
          <li><a href={appRoutes.attendance.records}>{appRoutes.attendance.records}</a> — 최근 기록 contract</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
