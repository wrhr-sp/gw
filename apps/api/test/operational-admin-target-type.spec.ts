import { describe, expect, it, vi } from "vitest";

const auditRows = [
  {
    id: "audit_post_1",
    company_id: "company_demo",
    actor_employee_id: "employee_employee",
    actor_user_id: "user_employee",
    action: "board.post.create",
    resource_type: "post",
    resource_id: "board_post_demo",
    before_json: null,
    after_json: { postId: "board_post_demo" },
    metadata_json: {
      category: "board",
      reason: "게시글 생성",
      source: "api-admin",
      maskedFields: ["bodyPreview"],
    },
    created_at: "2026-06-19T12:00:00.000Z",
  },
  {
    id: "audit_comment_1",
    company_id: "company_demo",
    actor_employee_id: "employee_employee",
    actor_user_id: "user_employee",
    action: "board.comment.create",
    resource_type: "comment",
    resource_id: "board_comment_demo",
    before_json: null,
    after_json: { commentId: "board_comment_demo" },
    metadata_json: {
      category: "board",
      reason: "댓글 생성",
      source: "api-admin",
      maskedFields: [],
    },
    created_at: "2026-06-19T12:01:00.000Z",
  },
] as const;

vi.mock("../src/lib/postgres", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/postgres")>("../src/lib/postgres");

  return {
    ...actual,
    createOperationalSql: () => {
      const sql = (async () => auditRows) as any;
      sql.query = async () => auditRows;
      return sql;
    },
  };
});

import { listOperationalAdminAuditLogs } from "../src/lib/operational-admin";

describe("operational admin audit target type mapping", () => {
  it("maps post/comment resource types to board_policy instead of generic audit_log", async () => {
    const items = await listOperationalAdminAuditLogs({ DATABASE_URL: "postgres://example" }, "company_demo");

    expect(items).not.toBeNull();
    expect(items?.map((item) => ({ id: item.id, targetType: item.targetType }))).toEqual([
      { id: "audit_post_1", targetType: "board_policy" },
      { id: "audit_comment_1", targetType: "board_policy" },
    ]);
    expect(items?.every((item) => item.metadata.category === "board")).toBe(true);
  });
});
