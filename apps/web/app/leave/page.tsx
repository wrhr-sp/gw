import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const leaveTypes = [
  { code: "annual", name: "연차", unit: "day", note: "기본 연차 placeholder" },
  { code: "half_day_am", name: "반차(오전)", unit: "half_day", note: "반일 사용 예시" },
  { code: "sick", name: "병가", unit: "day", note: "증빙/정책 엔진은 후속 Phase" },
] as const;

const balances = [
  { type: "연차", opening: 15, used: 3, reserved: 1, remaining: 11 },
  { type: "병가", opening: 10, used: 0, reserved: 0, remaining: 10 },
] as const;

const approvals = [
  { employee: "관리자 테스트", period: "2026-06-20", type: "연차", status: "pending", note: "인수인계 계획 확인 필요" },
  { employee: "운영 매니저", period: "2026-06-21 오전", type: "반차", status: "pending", note: "대체 근무자 확인 필요" },
] as const;

export default function LeavePage() {
  return (
    <PageShell
      eyebrow="모바일 휴가 신청/잔여 skeleton"
      title="휴가 skeleton"
      description="잔여 snapshot, 신청, 승인 대기 카드를 작은 화면 우선으로 정리하고 긴 표는 보조 표현으로 남긴 placeholder 입니다."
      actions={
        <div className="action-row">
          <span className="touch-button" aria-disabled="true">
            휴가 신청 placeholder
          </span>
          <span className="touch-button--secondary" aria-disabled="true">
            승인 대기 보기
          </span>
        </div>
      }
    >
      <SurfaceSection title="휴가 유형과 잔여 요약" description="모바일에서는 잔여 snapshot 을 카드형으로 먼저 읽습니다.">
        <div className="grid-auto">
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

      <SurfaceSection title="휴가 신청 placeholder" description="필드 순서를 줄이고 입력 부담을 최소화한 모바일 1차 구조입니다.">
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

      <SurfaceSection title="승인 / 반려 대기 placeholder" description="긴 목록 대신 카드형 대기 상태를 먼저 보여 줍니다." muted>
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
