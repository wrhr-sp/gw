import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AuditLogsPage from "./app/admin/audit-logs/page";
import EmployeesPage from "./app/employees/page";
import NotificationsPage from "./app/notifications/page";
import OrgPage from "./app/org/page";
import WorkItemsBranchPage from "./app/work-items/branch/page";

describe("Phase 34 real-usage entrypoints", () => {
  it("keeps employees page on general lookup while exposing the live employee directory panel", () => {
    const html = renderToStaticMarkup(<EmployeesPage />);

    expect(html).toContain("Phase 42 읽기 중심 인사 조회 도입");
    expect(html).toContain("실사용 조회 패널");
    expect(html).toContain("same-origin API 응답을 불러오는 중입니다.");
    expect(html).toContain("/admin/users");
    expect(html).not.toContain("권한 저장");
    expect(html).not.toContain("초대 실행");
  });

  it("keeps org page read-only while surfacing company and branch scope panels", () => {
    const html = renderToStaticMarkup(<OrgPage />);

    expect(html).toContain("실사용 조직 패널");
    expect(html).toContain("branch scope visible");
    expect(html).toContain("/admin/policies");
    expect(html).not.toContain("역할 생성");
  });

  it("renders the branch work-items page with live list-to-detail copy before the shared module explainer", () => {
    const html = renderToStaticMarkup(<WorkItemsBranchPage />);

    expect(html).toContain("Phase 42 branch scope 지점 운영 도입");
    expect(html).toContain("list → detail");
    expect(html).toContain("실사용 branch 패널");
    expect(html).toContain("branch scope 가드레일");
    expect(html).toContain("지점 업무");
    expect(html).toContain('href="/api/work-items?module=branch"');
  });

  it("keeps notifications honest about same-origin inbox vs external delivery", () => {
    const html = renderToStaticMarkup(<NotificationsPage />);

    expect(html).toContain("same-origin inbox");
    expect(html).toContain("외부 발송 없음");
    expect(html).toContain("실사용 알림 패널");
    expect(html).toContain("상태별 다음 행동");
    expect(html).toContain("복구 route 모음");
    expect(html).toContain("/dashboard");
    expect(html).not.toContain("발송 완료");
  });

  it("renders audit logs as an audit.read-gated live preview rather than a write surface", () => {
    const html = renderToStaticMarkup(<AuditLogsPage />);

    expect(html).toContain("Phase 48 감사·보안·복구 운영 기준선 preview");
    expect(html).toContain("audit.read");
    expect(html).toContain("실사용 감사 패널");
    expect(html).toContain("역할별 route/API guard 요약");
    expect(html).toContain("/api/health");
    expect(html).toContain("RUNBOOK.md");
    expect(html).toContain("storage preview 경계");
    expect(html).toContain("storageRef");
    expect(html).not.toContain("사용자 저장");
  });
});
