import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdminPage from "./app/admin/page";
import AdminUsersPage from "./app/admin/users/page";
import AdminPoliciesPage from "./app/admin/policies/page";
import AdminAuditLogsPage from "./app/admin/audit-logs/page";
import AttendancePage from "./app/attendance/page";

describe("Phase 13 admin console pass 1", () => {
  it("turns the admin hub into an operations-first console", () => {
    const html = renderToStaticMarkup(<AdminPage />);

    expect(html).toContain("오늘 먼저 볼 운영 체크포인트");
    expect(html).toContain("권한별 진입 경계");
    expect(html).toContain("저장 전 승인 게이트");
    expect(html).toContain("관리자 허브");
    expect(html.indexOf("오늘 먼저 볼 운영 체크포인트")).toBeLessThan(html.indexOf("권한별 진입 경계"));
  });

  it("shows user review queues and audit-ready diffs before any save action", () => {
    const html = renderToStaticMarkup(<AdminUsersPage />);

    expect(html).toContain("오늘 확인할 사용자 큐");
    expect(html).toContain("권한 diff 미리보기");
    expect(html).toContain("상태 변경 preview");
    expect(html).toContain("감사 이벤트 preview");
    expect(html).not.toContain("실제 저장 실행");
  });

  it("keeps policy review cards in a consistent current-candidate-capability format", () => {
    const html = renderToStaticMarkup(<AdminPoliciesPage />);

    expect(html).toContain("현재 운영 기준");
    expect(html).toContain("candidate 변경안");
    expect(html).toContain("필요 capability");
    expect(html).toContain("감사 preview");
    expect(html).toContain("문서 / 첨부 정책");
    expect(html).toContain("근태 / 출퇴근 등록 방식 정책");
    expect(html).toContain("현재 허용 방식");
    expect(html).toContain("candidate 허용 방식");
    expect(html).toContain("태그 단말 연동 예정 skeleton");
  });

  it("shows only the policy-approved attendance methods on the employee attendance page", () => {
    const html = renderToStaticMarkup(<AttendancePage />);

    expect(html).toContain("모바일 출근 등록");
    expect(html).toContain("PC 출근 등록");
    expect(html).not.toContain("태그 단말 출근 등록");
    expect(html).toContain("태그 단말 연동은 별도 승인 후 연결합니다");
  });

  it("keeps audit logs focused on filters, timeline, detail context, and masking boundaries", () => {
    const html = renderToStaticMarkup(<AdminAuditLogsPage />);

    expect(html).toContain("조회 필터");
    expect(html).toContain("최근 이벤트 타임라인");
    expect(html).toContain("상세 패널");
    expect(html).toContain("비노출/회사 경계");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("signed URL");
    expect(html).not.toContain("bucket");
  });
});
