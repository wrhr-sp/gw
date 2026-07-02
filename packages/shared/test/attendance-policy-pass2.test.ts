import { describe, expect, it } from "vitest";

import {
  attendancePolicyAssignmentSchema,
  attendancePolicyLevelSchema,
  buildAttendancePolicyPreview,
  createAttendancePolicyAssignment,
  demoAttendancePolicyAssignments,
  demoAttendancePolicySubjects,
  resolveEffectiveAttendancePolicy,
} from "../src";

describe("attendance registration policy pass 2 shared config", () => {
  it("accepts only the four supported policy levels", () => {
    expect(attendancePolicyLevelSchema.options).toEqual(["company_default", "workplace", "department", "job_type"]);
    expect(() => attendancePolicyLevelSchema.parse("employee")).toThrow();
  });

  it("validates assignment shape with target and priority metadata", () => {
    const assignment = attendancePolicyAssignmentSchema.parse(
      createAttendancePolicyAssignment({
        id: "policy_department_ops",
        companyId: "company_demo",
        policyLevel: "department",
        policyTargetId: "department_ops",
        policyTargetLabel: "운영팀",
        allowedAttendanceRegistrationMethods: ["pc"],
        candidateAllowedAttendanceRegistrationMethods: ["tag"],
        tagDeviceStatus: "approval_required",
      }),
    );

    expect(assignment.priorityRank).toBe(2);
    expect(assignment.policyTargetLabel).toBe("운영팀");
  });

  it("resolves effective policy by company < workplace < department < job_type without union merging", () => {
    const result = resolveEffectiveAttendancePolicy({
      assignments: demoAttendancePolicyAssignments,
      subject: demoAttendancePolicySubjects.employee,
    });

    expect(result.effectivePolicySource.policyLevel).toBe("job_type");
    expect(result.effectivePolicySource.policyTargetLabel).toBe("현장직");
    expect(result.effectiveAttendanceRegistrationMethods).toEqual(["tag"]);
    expect(result.matchedAttendancePolicies.map((item) => item.policyLevel)).toEqual([
      "company_default",
      "workplace",
      "department",
      "job_type",
    ]);
    expect(result.matchedAttendancePolicies[1]?.allowedAttendanceRegistrationMethods).toEqual(["mobile"]);
    expect(result.effectiveAttendanceRegistrationMethods).not.toEqual(["mobile", "tag"]);
  });

  it("builds admin preview data with policy subjects, target counts, and duplicate warnings", () => {
    const preview = buildAttendancePolicyPreview({
      assignments: demoAttendancePolicyAssignments,
      subjects: Object.values(demoAttendancePolicySubjects),
    });

    expect(preview.priorityOrder).toEqual(["company_default", "workplace", "department", "job_type"]);
    expect(preview.policySubjectSummaries).toHaveLength(4);
    expect(preview.scopeSummaries.find((item) => item.policyTargetId === "department_ops")?.appliedEmployeeCount).toBe(2);
    expect(preview.duplicateWarnings).toContain("동일 target 활성 정책 중복: 근무지/지점 · 원격 실험실");
  });
});
