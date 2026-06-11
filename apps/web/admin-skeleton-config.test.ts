import { describe, expect, it } from "vitest";
import {
  adminApprovalGateNotes,
  adminAuditBoundaryNotes,
  adminAuditLogPreviewFilters,
  adminAuditNotes,
  adminHubCards,
  adminHubPriorityChecks,
  adminPolicyReviewChecklist,
  adminPolicySections,
  adminRoleEntryRules,
  adminUserQueues,
} from "./admin-skeleton-config";

describe("Phase 13 admin skeleton config", () => {
  it("keeps the admin hub focused on users, policies, and audit logs", () => {
    expect(adminHubCards.map((card) => card.href)).toEqual(["/admin/users", "/admin/policies", "/admin/audit-logs"]);
    expect(adminHubPriorityChecks).toContain("저장 실행 대신 candidate/diff/audit preview 로 끝나는지 확인");
  });

  it("describes policy cards in current-candidate-capability format without raw storage internals", () => {
    expect(adminPolicySections[0]).toMatchObject({
      title: "문서 / 첨부 정책",
      capability: "document.space.manage",
    });
    expect(adminPolicySections.every((section) => section.maskingNote.includes("노출하지 않습니다") || section.maskingNote.includes("붙이지 않습니다") || section.maskingNote.includes("제외"))).toBe(true);
  });

  it("keeps user queues, entry rules, and approval gates in operations-first placeholder scope", () => {
    expect(adminUserQueues.map((item) => item.title)).toContain("연결 검토 우선순위");
    expect(adminRoleEntryRules).toContain("일반 로그인 사용자: 관리자 CTA 미노출 + `/forbidden` 차단 유지");
    expect(adminApprovalGateNotes).toContain("실제 운영 사용자/권한 변경은 이번 범위에서 실행하지 않습니다.");
  });

  it("keeps audit filters and boundaries in masked read-only scope", () => {
    expect(adminAuditLogPreviewFilters).toEqual(["actor", "action", "target", "time", "category"]);
    expect(adminPolicyReviewChecklist).toContain("감사 preview 와 company boundary 유지");
    expect(adminAuditNotes[0]).toContain("비밀값");
    expect(adminAuditBoundaryNotes).toContain("export/download 없이 화면 조회와 review 메모 기준만 고정합니다.");
  });
});
