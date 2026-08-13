import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IssueWorkspace } from "../components/issues/issue-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const actorUserId = "20000000-0000-4000-8000-000000000001";
const publicIssue = {
  assignee: {
    displayName: "현장 담당",
  },
  createdAt: "2026-08-12T12:00:00.000Z",
  description: "로비에 반복적인 소음 신고가 접수됐습니다.",
  hotelId,
  id: "d9400000-0000-4000-8000-000000000001",
  isOverdue: false,
  publicComments: [],
  resumeDueAt: null,
  severity: "MAJOR" as const,
  status: "IN_PROGRESS" as const,
  title: "로비 소음 신고",
  updatedAt: "2026-08-12T12:00:00.000Z",
  version: 3,
};
const internalIssue = {
  ...publicIssue,
  assignee: { ...publicIssue.assignee, userId: actorUserId },
  internalNotes: [],
  statusHistory: [],
  workLogs: [],
};
const fullCapability = {
  actorUserId,
  canComment: true,
  canCreate: true,
  canManage: true,
  canRead: true,
  canWork: true,
  hotelId,
  hotelName: "서울호텔",
};
const assignments = [
  {
    assignee: {
      displayName: "현장 담당",
      userId: actorUserId,
      userType: "INTERNAL_STAFF" as const,
    },
    assignmentType: "PRIMARY" as const,
    createdAt: "2026-08-01T00:00:00.000Z",
    endDate: null,
    hotelId,
    id: "d9600000-0000-4000-8000-000000000001",
    reason: "운영 담당",
    relationshipType: "STAFF" as const,
    startDate: "2026-08-01",
    terminatedAt: null,
    terminationReason: null,
    updatedAt: "2026-08-01T00:00:00.000Z",
    userId: actorUserId,
    version: 1,
  },
];

function renderWorkspace(node: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      {node}
    </QueryClientProvider>,
  );
}

describe("operational issue workspace", () => {
  it("renders the PC master/detail and mobile action-first controls", () => {
    const html = renderWorkspace(
      <IssueWorkspace
        assignments={assignments}
        capability={fullCapability}
        hotelId={hotelId}
        initialIssues={[publicIssue]}
        initialSelected={internalIssue}
      />,
    );
    expect(html).toContain("운영이슈");
    expect(html).toContain("로비 소음 신고");
    expect(html).toContain("처리중");
    expect(html).toContain("보류");
    expect(html).toContain("조치 완료");
    expect(html).toContain("작업기록");
    expect(html).toContain("내부메모");
    expect(html).toContain("공개댓글");
    expect(html).toContain("이슈 등록");
  });

  it("hides every mutation action when dynamic capability is read-only", () => {
    const html = renderWorkspace(
      <IssueWorkspace
        assignments={assignments}
        capability={{
          ...fullCapability,
          canComment: false,
          canCreate: false,
          canManage: false,
          canWork: false,
        }}
        hotelId={hotelId}
        initialIssues={[publicIssue]}
        initialSelected={internalIssue}
      />,
    );
    expect(html).not.toContain("이슈 등록");
    expect(html).not.toContain("보류");
    expect(html).not.toContain("조치 완료");
    expect(html).not.toContain("작업기록</button>");
    expect(html).not.toContain("내부메모</button>");
    expect(html).not.toContain("공개댓글</button>");
  });

  it("does not render private work logs or internal notes for an owner-safe detail", () => {
    const html = renderWorkspace(
      <IssueWorkspace
        assignments={[]}
        hotelId={hotelId}
        initialIssues={[publicIssue]}
        initialSelected={publicIssue}
      />,
    );
    expect(html).toContain("공개댓글");
    expect(html).not.toContain("내부메모");
    expect(html).not.toContain("작업기록");
    expect(html).not.toContain("현장 행동");
  });

  it("keeps direct routes for forbidden or missing issues on the not-found path", () => {
    const pageSource = readFileSync(
      new URL("../app/hotels/[hotelId]/issues/page.tsx", import.meta.url),
      "utf8",
    );
    const fetchSource = readFileSync(
      new URL("../lib/server-issues.ts", import.meta.url),
      "utf8",
    );
    expect(pageSource).toContain(
      '["FORBIDDEN", "RESOURCE_NOT_FOUND"].includes(result.code)',
    );
    expect(pageSource).toContain("notFound();");
    expect(fetchSource).toContain(
      'code: error.success ? error.data.error.code : "INTERNAL_ERROR"',
    );
  });
});
