import type {
  AttendancePolicyAssignment,
  AttendancePolicyLevel,
  AttendancePolicyPreview,
  AttendancePolicyRule,
  AttendanceRegistrationMethod,
  AttendanceRegistrationPolicy,
  EffectiveAttendancePolicy,
} from "./contracts";

export type AttendancePolicySubject = {
  employeeId: string;
  fullName: string;
  workplaceId: string | null;
  workplaceLabel: string | null;
  departmentId: string | null;
  departmentLabel: string | null;
  jobTypeId: string | null;
  jobTypeLabel: string | null;
};

const attendancePolicyPriorityOrder = ["company_default", "workplace", "department", "job_type"] as const satisfies readonly AttendancePolicyLevel[];
const attendancePolicyPriorityByLevel: Record<AttendancePolicyLevel, number> = {
  company_default: 0,
  workplace: 1,
  department: 2,
  job_type: 3,
};

const attendancePolicyLevelLabels: Record<AttendancePolicyLevel, string> = {
  company_default: "회사 기본",
  workplace: "근무지/지점",
  department: "부서/팀",
  job_type: "직무/역할",
};

type CreateAttendancePolicyAssignmentInput = {
  id: string;
  companyId: string;
  policyLevel: AttendancePolicyLevel;
  policyTargetId: string;
  policyTargetLabel: string;
  allowedAttendanceRegistrationMethods: AttendanceRegistrationMethod[];
  candidateAllowedAttendanceRegistrationMethods: AttendanceRegistrationMethod[];
  tagDeviceStatus: AttendanceRegistrationPolicy["tagDeviceStatus"];
  active?: boolean;
  priorityRank?: number;
};

export function createAttendancePolicyAssignment(input: CreateAttendancePolicyAssignmentInput): AttendancePolicyAssignment {
  return {
    ...input,
    active: input.active ?? true,
    priorityRank: input.priorityRank ?? attendancePolicyPriorityByLevel[input.policyLevel],
  };
}

function matchesAttendancePolicyTarget(assignment: AttendancePolicyAssignment, subject: AttendancePolicySubject) {
  switch (assignment.policyLevel) {
    case "company_default":
      return true;
    case "workplace":
      return assignment.policyTargetId === subject.workplaceId;
    case "department":
      return assignment.policyTargetId === subject.departmentId;
    case "job_type":
      return assignment.policyTargetId === subject.jobTypeId;
  }
}

function toAttendancePolicyRule(assignment: AttendancePolicyAssignment): AttendancePolicyRule {
  return {
    policyLevel: assignment.policyLevel,
    policyTargetId: assignment.policyTargetId,
    policyTargetLabel: assignment.policyTargetLabel,
    priorityRank: assignment.priorityRank,
    allowedAttendanceRegistrationMethods: assignment.allowedAttendanceRegistrationMethods,
    candidateAllowedAttendanceRegistrationMethods: assignment.candidateAllowedAttendanceRegistrationMethods,
    tagDeviceStatus: assignment.tagDeviceStatus,
  };
}

function buildEffectivePolicySummary(subject: AttendancePolicySubject, winner: AttendancePolicyAssignment) {
  if (winner.policyLevel === "job_type") {
    const prefix = subject.workplaceLabel ?? subject.departmentLabel ?? "회사 기본";
    return `현재 적용 정책: ${prefix} > ${winner.policyTargetLabel} 기준`;
  }

  if (winner.policyLevel === "department") {
    return `현재 적용 정책: ${winner.policyTargetLabel} 기준`;
  }

  if (winner.policyLevel === "workplace") {
    return `현재 적용 정책: ${winner.policyTargetLabel} 기준`;
  }

  return "현재 적용 정책: 회사 기본 기준";
}

export function resolveEffectiveAttendancePolicy({
  assignments,
  subject,
}: {
  assignments: AttendancePolicyAssignment[];
  subject: AttendancePolicySubject;
}): EffectiveAttendancePolicy {
  const matchedAttendancePolicies = assignments
    .filter((assignment) => assignment.active)
    .filter((assignment) => matchesAttendancePolicyTarget(assignment, subject))
    .sort((left, right) => left.priorityRank - right.priorityRank || left.id.localeCompare(right.id));

  const effectivePolicySource = matchedAttendancePolicies.at(-1) ?? assignments[0];

  if (!effectivePolicySource) {
    throw new Error("attendance policy assignments are required");
  }

  return {
    employeeId: subject.employeeId,
    effectiveAttendanceRegistrationMethods: effectivePolicySource.allowedAttendanceRegistrationMethods,
    effectiveAttendancePolicy: toAttendancePolicyRule(effectivePolicySource),
    effectivePolicySource,
    matchedAttendancePolicies,
    summary: buildEffectivePolicySummary(subject, effectivePolicySource),
  };
}

export function buildAttendancePolicyPreview({
  assignments,
  subjects,
}: {
  assignments: AttendancePolicyAssignment[];
  subjects: AttendancePolicySubject[];
}): AttendancePolicyPreview {
  const activeAssignments = assignments.filter((assignment) => assignment.active);
  const grouped = new Map<string, AttendancePolicyAssignment[]>();

  for (const assignment of activeAssignments) {
    const key = `${assignment.policyLevel}:${assignment.policyTargetId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), assignment]);
  }

  const duplicateWarnings = [...grouped.values()]
    .filter((items) => items.length > 1)
    .map((items) => `동일 target 활성 정책 중복: ${attendancePolicyLevelLabels[items[0]!.policyLevel]} · ${items[0]!.policyTargetLabel}`);

  return {
    priorityOrder: [...attendancePolicyPriorityOrder],
    scopeSummaries: activeAssignments.map((assignment) => ({
      ...assignment,
      appliedEmployeeCount: subjects.filter((subject) => matchesAttendancePolicyTarget(assignment, subject)).length,
    })),
    sampleEmployees: subjects.map((subject) => resolveEffectiveAttendancePolicy({ assignments, subject })),
    duplicateWarnings,
  };
}

export const demoAttendancePolicySubjects: Record<string, AttendancePolicySubject> = {
  admin: {
    employeeId: "employee_admin",
    fullName: "관리자 테스트",
    workplaceId: "workplace_seoul_hq",
    workplaceLabel: "서울 본사",
    departmentId: "department_exec",
    departmentLabel: "경영지원",
    jobTypeId: "job_type_admin_general",
    jobTypeLabel: "운영총괄",
  },
  manager: {
    employeeId: "employee_manager",
    fullName: "운영 매니저",
    workplaceId: "workplace_seoul_hq",
    workplaceLabel: "서울 본사",
    departmentId: "department_ops",
    departmentLabel: "운영팀",
    jobTypeId: "job_type_office_manager",
    jobTypeLabel: "사무직 매니저",
  },
  staff: {
    employeeId: "employee_staff",
    fullName: "인사 담당자",
    workplaceId: "workplace_seoul_hq",
    workplaceLabel: "서울 본사",
    departmentId: "department_hr",
    departmentLabel: "인사팀",
    jobTypeId: "job_type_hr_specialist",
    jobTypeLabel: "HR 담당",
  },
  employee: {
    employeeId: "employee_employee",
    fullName: "일반 구성원",
    workplaceId: "workplace_busan_logistics",
    workplaceLabel: "부산 물류센터",
    departmentId: "department_ops",
    departmentLabel: "운영팀",
    jobTypeId: "job_type_field_worker",
    jobTypeLabel: "현장직",
  },
};

export const demoAttendancePolicyAssignments: AttendancePolicyAssignment[] = [
  createAttendancePolicyAssignment({
    id: "policy_company_default",
    companyId: "company_demo",
    policyLevel: "company_default",
    policyTargetId: "company_demo",
    policyTargetLabel: "회사 기본",
    allowedAttendanceRegistrationMethods: ["mobile", "pc"],
    candidateAllowedAttendanceRegistrationMethods: ["mobile", "tag"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_workplace_seoul_hq",
    companyId: "company_demo",
    policyLevel: "workplace",
    policyTargetId: "workplace_seoul_hq",
    policyTargetLabel: "서울 본사",
    allowedAttendanceRegistrationMethods: ["mobile", "pc"],
    candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_workplace_busan_logistics",
    companyId: "company_demo",
    policyLevel: "workplace",
    policyTargetId: "workplace_busan_logistics",
    policyTargetLabel: "부산 물류센터",
    allowedAttendanceRegistrationMethods: ["mobile"],
    candidateAllowedAttendanceRegistrationMethods: ["mobile", "tag"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_department_ops",
    companyId: "company_demo",
    policyLevel: "department",
    policyTargetId: "department_ops",
    policyTargetLabel: "운영팀",
    allowedAttendanceRegistrationMethods: ["pc"],
    candidateAllowedAttendanceRegistrationMethods: ["pc", "tag"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_department_hr",
    companyId: "company_demo",
    policyLevel: "department",
    policyTargetId: "department_hr",
    policyTargetLabel: "인사팀",
    allowedAttendanceRegistrationMethods: ["mobile", "pc"],
    candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_job_type_field_worker",
    companyId: "company_demo",
    policyLevel: "job_type",
    policyTargetId: "job_type_field_worker",
    policyTargetLabel: "현장직",
    allowedAttendanceRegistrationMethods: ["tag"],
    candidateAllowedAttendanceRegistrationMethods: ["tag"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_job_type_office_manager",
    companyId: "company_demo",
    policyLevel: "job_type",
    policyTargetId: "job_type_office_manager",
    policyTargetLabel: "사무직 매니저",
    allowedAttendanceRegistrationMethods: ["mobile", "pc"],
    candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_job_type_hr_specialist",
    companyId: "company_demo",
    policyLevel: "job_type",
    policyTargetId: "job_type_hr_specialist",
    policyTargetLabel: "HR 담당",
    allowedAttendanceRegistrationMethods: ["mobile"],
    candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_workplace_remote_lab_primary",
    companyId: "company_demo",
    policyLevel: "workplace",
    policyTargetId: "workplace_remote_lab",
    policyTargetLabel: "원격 실험실",
    allowedAttendanceRegistrationMethods: ["pc"],
    candidateAllowedAttendanceRegistrationMethods: ["pc"],
    tagDeviceStatus: "skeleton_only",
  }),
  createAttendancePolicyAssignment({
    id: "policy_workplace_remote_lab_secondary",
    companyId: "company_demo",
    policyLevel: "workplace",
    policyTargetId: "workplace_remote_lab",
    policyTargetLabel: "원격 실험실",
    allowedAttendanceRegistrationMethods: ["mobile"],
    candidateAllowedAttendanceRegistrationMethods: ["mobile"],
    tagDeviceStatus: "skeleton_only",
  }),
];
