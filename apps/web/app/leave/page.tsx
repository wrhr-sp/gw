import Link from "next/link";
import { appRoutes } from "@gw/shared";

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
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px", display: "grid", gap: 24 }}>
      <div>
        <Link href="/">← 홈으로</Link>
        <h1 style={{ marginBottom: 12 }}>휴가 skeleton</h1>
        <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
          휴가 유형, 잔여 snapshot, 신청, 승인/반려 대기 목록의 정보구조를 고정하는 placeholder 입니다.
          자동 차감·이월·소멸 계산, 실제 알림 발송, payroll 연동은 이번 범위에 포함되지 않습니다.
        </p>
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>휴가 유형 / 잔여 placeholder</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {leaveTypes.map((item) => (
            <article key={item.code} style={{ border: "1px solid #f3f4f6", borderRadius: 16, padding: 16 }}>
              <p style={{ margin: 0, color: "#4b5563", fontSize: 14 }}>{item.code}</p>
              <h3 style={{ margin: "8px 0" }}>{item.name}</h3>
              <p style={{ margin: 0, lineHeight: 1.6 }}>단위: {item.unit}</p>
              <p style={{ marginBottom: 0, lineHeight: 1.6, color: "#6b7280" }}>{item.note}</p>
            </article>
          ))}
        </div>
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>유형</th>
                <th style={{ padding: "10px 8px" }}>기초</th>
                <th style={{ padding: "10px 8px" }}>사용</th>
                <th style={{ padding: "10px 8px" }}>예약</th>
                <th style={{ padding: "10px 8px" }}>잔여</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.type} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 8px" }}>{row.type}</td>
                  <td style={{ padding: "12px 8px" }}>{row.opening}</td>
                  <td style={{ padding: "12px 8px" }}>{row.used}</td>
                  <td style={{ padding: "12px 8px" }}>{row.reserved}</td>
                  <td style={{ padding: "12px 8px" }}>{row.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0, marginTop: 16 }}>
          <li><a href={appRoutes.leave.types}>{appRoutes.leave.types}</a></li>
          <li><a href={appRoutes.leave.balances}>{appRoutes.leave.balances}</a></li>
        </ul>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>휴가 신청 placeholder</h2>
        <p style={{ lineHeight: 1.7 }}>
          employee 는 leave.request 권한으로 신청하고, 승인자는 leave.approve 권한으로 별도 승인/반려 endpoint 를 사용합니다.
        </p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <input disabled value="leave_type_annual" readOnly style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280" }} />
          <input disabled value="2026-06-20" readOnly style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280" }} />
          <input disabled value="2026-06-20" readOnly style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280" }} />
          <input disabled value="1 day" readOnly style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280" }} />
        </div>
        <textarea disabled rows={4} style={{ marginTop: 12, border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280", width: "100%" }} defaultValue="가족 행사" />
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0, marginTop: 16 }}>
          <li><a href={appRoutes.leave.requests}>{appRoutes.leave.requests}</a> — 조회/신청 skeleton</li>
          <li>잔여 값은 자동 계산 확정본이 아니라 snapshot placeholder 입니다.</li>
        </ul>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>승인 / 반려 대기 placeholder</h2>
        <p style={{ lineHeight: 1.7 }}>
          승인자는 대기 목록을 보고 approve / reject endpoint 로 상태를 바꾸지만, 이 Phase 에서는 실제 알림 발송이나 결재 문서 연동을 하지 않습니다.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {approvals.map((row) => (
            <article key={`${row.employee}-${row.period}`} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white" }}>
              <strong>{row.employee}</strong>
              <p style={{ margin: "8px 0", lineHeight: 1.6 }}>{row.type} / {row.period} / {row.status}</p>
              <p style={{ margin: "8px 0 0", lineHeight: 1.6, color: "#6b7280" }}>{row.note}</p>
            </article>
          ))}
        </div>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0, marginTop: 16 }}>
          <li><a href={appRoutes.leave.approve("leave_request_demo")}>{appRoutes.leave.approve("leave_request_demo")}</a></li>
          <li><a href={appRoutes.leave.reject("leave_request_demo")}>{appRoutes.leave.reject("leave_request_demo")}</a></li>
          <li>민감한 실제 사유 전문과 증빙 파일은 placeholder 범위에서 마스킹/미연결 상태를 유지합니다.</li>
        </ul>
      </section>
    </main>
  );
}
