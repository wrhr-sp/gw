import Link from "next/link";
import { appRoutes } from "@gw/shared";

const todaySummary = [
  { label: "오늘 상태", value: "placeholder / 퇴근 완료 예시", note: "실제 법정 근태 마감이나 급여 반영 상태가 아닙니다." },
  { label: "권한 기준", value: "attendance.read / attendance.manage", note: "본인 출퇴근과 관리자 정정 검토 권한을 분리합니다." },
  { label: "감사 로그 후보", value: "check-in · check-out · correction request", note: "상태 변경 endpoint 는 audit candidate 구조를 남깁니다." },
] as const;

const recordRows = [
  { workDate: "2026-06-10", status: "checked_out", checkInAt: "09:00", checkOutAt: "18:00", note: "placeholder day" },
  { workDate: "2026-06-09", status: "needs_correction", checkInAt: "09:05", checkOutAt: "-", note: "퇴근 누락 placeholder" },
] as const;

const filters = [
  { label: "기간", placeholder: "2026-06-01 ~ 2026-06-30" },
  { label: "직원", placeholder: "관리 권한이 있으면 employee_id 기준 조회 확장" },
] as const;

export default function AttendancePage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px", display: "grid", gap: 24 }}>
      <div>
        <Link href="/">← 홈으로</Link>
        <h1 style={{ marginBottom: 12 }}>근태 skeleton</h1>
        <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
          출근/퇴근, 근태 기록 조회, 정정 요청의 화면 경계와 문구를 먼저 고정한 placeholder 입니다.
          실제 근무시간 계산, GPS 인증, 급여 반영, production 데이터 수정은 이 Phase 범위에 포함되지 않습니다.
        </p>
      </div>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {todaySummary.map((card) => (
          <article key={card.label} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
            <p style={{ margin: 0, color: "#4b5563", fontSize: 14 }}>{card.label}</p>
            <h2 style={{ margin: "10px 0", fontSize: 20 }}>{card.value}</h2>
            <p style={{ margin: 0, lineHeight: 1.6, color: "#6b7280" }}>{card.note}</p>
          </article>
        ))}
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>오늘 출퇴근</h2>
        <p style={{ lineHeight: 1.7 }}>
          버튼은 실제 제출 대신 어떤 endpoint 와 연결될지 보여주는 skeleton 입니다.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" disabled style={{ padding: "12px 18px", borderRadius: 999, border: "1px solid #d1d5db", background: "#111827", color: "white", opacity: 0.7 }}>
            출근 등록 placeholder
          </button>
          <button type="button" disabled style={{ padding: "12px 18px", borderRadius: 999, border: "1px solid #d1d5db", background: "white", color: "#111827" }}>
            퇴근 등록 placeholder
          </button>
        </div>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0, marginTop: 16 }}>
          <li><a href={appRoutes.attendance.checkIn}>{appRoutes.attendance.checkIn}</a></li>
          <li><a href={appRoutes.attendance.checkOut}>{appRoutes.attendance.checkOut}</a></li>
          <li><a href={appRoutes.attendance.records}>{appRoutes.attendance.records}</a></li>
        </ul>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>근태 기록 목록 / 필터 placeholder</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {filters.map((filter) => (
            <label key={filter.label} style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{filter.label}</span>
              <input disabled value={filter.placeholder} style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280" }} readOnly />
            </label>
          ))}
        </div>
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>근무일</th>
                <th style={{ padding: "10px 8px" }}>상태</th>
                <th style={{ padding: "10px 8px" }}>출근</th>
                <th style={{ padding: "10px 8px" }}>퇴근</th>
                <th style={{ padding: "10px 8px" }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {recordRows.map((row) => (
                <tr key={row.workDate} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 8px" }}>{row.workDate}</td>
                  <td style={{ padding: "12px 8px" }}>{row.status}</td>
                  <td style={{ padding: "12px 8px" }}>{row.checkInAt}</td>
                  <td style={{ padding: "12px 8px" }}>{row.checkOutAt}</td>
                  <td style={{ padding: "12px 8px" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>정정 요청 placeholder</h2>
        <p style={{ lineHeight: 1.7 }}>
          실제 승인 엔진 대신 requested_by / reviewed_by / reviewed_at 를 남길 contract 부터 맞춥니다.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          <input disabled value="attendance_record_today" readOnly style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280" }} />
          <textarea disabled rows={4} style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: "12px 14px", color: "#6b7280" }} defaultValue="퇴근 시간이 누락되었습니다. / QR 체크아웃 누락" />
        </div>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0, marginTop: 16 }}>
          <li><a href={appRoutes.attendance.corrections}>{appRoutes.attendance.corrections}</a> — 정정 요청 생성 skeleton</li>
          <li>민감한 실제 위치/GPS/기기 식별 값은 placeholder 단계에서 저장·노출하지 않습니다.</li>
        </ul>
      </section>
    </main>
  );
}
