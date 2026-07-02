import React from "react";
import { readFileSync } from "fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getWorkItemAccessCapabilities } from "./app/_components/phase34-live-sections";
import AuditLogsPage from "./app/admin/audit-logs/page";
import EmployeesPage from "./app/employees/page";
import OrgPage from "./app/org/page";
import WorkItemsBranchPage from "./app/work-items/branch/page";

describe("Phase 34 real-usage entrypoints", () => {
  it("keeps employees page on general lookup without admin save actions", () => {
    const html = renderToStaticMarkup(<EmployeesPage />);

    expect(html).toContain("직원 목록");
    expect(html).toContain("직원 상세");
    expect(html).toContain("근무 상태");
    expect(html).toContain("권한 요청");
    expect(html).toContain("employee.read 기준의 조회 화면이며 계정 생성·권한 변경은 관리자 화면에서만 처리합니다.");
    expect(html).toContain("조회 가능한 직원이 없으면");
    const employeesSource = readFileSync(new URL("./app/employees/page.tsx", import.meta.url), "utf8");
    expect(employeesSource).toContain("검색 초기화");
    expect(html).not.toContain("권한 저장");
    expect(html).not.toContain("초대 실행");
    expect(html).not.toContain("Phase");
  });

  it("keeps org page read-only while surfacing company and branch scope panels", () => {
    const html = renderToStaticMarkup(<OrgPage />);

    expect(html).toContain("조직도");
    expect(html).toContain("조직 트리");
    expect(html).toContain("부서 상세");
    expect(html).toContain("구성원");
    expect(html).toContain("접근 범위");
    expect(html).toContain("표시할 조직 없음");
    expect(html).toContain("조직 조회는 read-only이며 역할·정책 변경은 관리자 영역으로 분리합니다.");
    expect(html).toContain("범위 확인");
    const orgSource = readFileSync(new URL("./app/org/page.tsx", import.meta.url), "utf8");
    expect(orgSource).toContain("범위 확인");
    expect(html).not.toContain("역할 생성");
    expect(html).not.toContain("운영 DB seed");
  });

  it("renders the branch work-items page with live list-to-detail copy before the shared module explainer", () => {
    const html = renderToStaticMarkup(<WorkItemsBranchPage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("지점 업무");
    expect(html).toContain("업무 목록");
    expect(html).toContain("접수/분류");
    expect(html).toContain("검토/마감");
    expect(html).toContain("권한 범위");
    expect(html).not.toContain("Phase");
    expect(html).not.toContain("happy path");
  });

  it("keeps branch work item capability labels compatible with current API payload names", () => {
    expect(
      getWorkItemAccessCapabilities({
        viewerScope: "branch",
        capabilities: ["work_item.read", "work_item.deadline.read"],
        maskedFields: [],
      }).join(", "),
    ).toBe("work_item.read, work_item.deadline.read");

    expect(
      getWorkItemAccessCapabilities({
        viewerScope: "branch",
        allowedCapabilities: ["legacy.read"],
        maskedFields: [],
      }).join(", "),
    ).toBe("legacy.read");
  });

  it("renders audit logs as an audit.read-gated live preview rather than a write surface", () => {
    const html = renderToStaticMarkup(<AuditLogsPage />);

    expect(html).toContain("Phase 56 감사 read-only / audit.read 경계 확인");
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
