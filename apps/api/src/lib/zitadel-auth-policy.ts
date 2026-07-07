export const groupwareZitadelMetadataKeys = {
  userType: "gw.user_type",
  registrationStatus: "gw.registration_status",
} as const;

export const groupwareZitadelUserTypeOptions = [
  {
    code: "INTERNAL_STAFF",
    displayName: "사내임직원",
    employeeIdEligible: true,
    defaultPermissionProfileCode: "internal_staff_default",
  },
  {
    code: "ROOM_OPERATIONS",
    displayName: "객실관리직",
    employeeIdEligible: false,
    defaultPermissionProfileCode: "room_operations_default",
  },
  {
    code: "BRANCH_OWNER",
    displayName: "지점대표",
    employeeIdEligible: false,
    defaultPermissionProfileCode: "branch_owner_default",
  },
  {
    code: "PARTNER_EMPLOYEE",
    displayName: "거래처임직원",
    employeeIdEligible: false,
    defaultPermissionProfileCode: "partner_employee_default",
  },
] as const;

export type GroupwareZitadelUserType = (typeof groupwareZitadelUserTypeOptions)[number]["code"];
export type GroupwareZitadelUserTypeDisplayName = (typeof groupwareZitadelUserTypeOptions)[number]["displayName"];

export const groupwareZitadelUserTypes = groupwareZitadelUserTypeOptions.map((option) => option.code) as [
  GroupwareZitadelUserType,
  ...GroupwareZitadelUserType[],
];

export const groupwareZitadelRegistrationStatuses = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;

export type GroupwareZitadelRegistrationStatus = (typeof groupwareZitadelRegistrationStatuses)[number];

export const groupwareZitadelLoginAllowedRegistrationStatuses: readonly GroupwareZitadelRegistrationStatus[] = ["APPROVED"];

export const groupwareZitadelStepUpPolicy = {
  idleTimeoutMinutes: 30,
  refreshMode: "sliding_idle_timeout",
  activityBasis: "sensitive_route_or_api_activity",
  targets: [
    "ADMIN_USER_MANAGEMENT",
    "PERMISSION_POLICY_CHANGE",
    "SECURITY_SETTING_CHANGE",
    "APPROVAL_DECISION",
    "PAYROLL_LABOR_SENSITIVE_ACCESS",
    "PERSONAL_DATA_OR_FILE_PERMISSION_CHANGE",
  ],
} as const;

export type GroupwareZitadelStepUpTarget = (typeof groupwareZitadelStepUpPolicy.targets)[number];

export function assertGroupwareZitadelUserType(value: string): GroupwareZitadelUserType {
  const matchedByCode = groupwareZitadelUserTypeOptions.find((option) => option.code === value);
  if (matchedByCode) {
    return matchedByCode.code;
  }

  const matchedByDisplayName = groupwareZitadelUserTypeOptions.find((option) => option.displayName === value);
  if (matchedByDisplayName) {
    return matchedByDisplayName.code;
  }

  throw new Error(`Unsupported ZITADEL user type: ${value}`);
}

export function getGroupwareZitadelUserTypeOption(userType: GroupwareZitadelUserType) {
  return groupwareZitadelUserTypeOptions.find((option) => option.code === userType);
}
