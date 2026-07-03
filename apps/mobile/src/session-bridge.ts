import {
  appRoutes,
  hasNativeMobileApprovalLaneAccess,
  nativeMobilePermissionHints,
  nativeMobileSessionBridgePolicy,
  type PermissionCode,
  type RoleCode,
} from "@gw/shared";

export type NativeSessionSnapshot = {
  sessionId: string;
  status: "authenticated" | "signed_out";
  expiresAt: string;
  companyId?: string;
  employeeId?: string;
  roleCodes: readonly RoleCode[];
  permissions: readonly PermissionCode[];
  source: "local-verification" | "approved-origin";
};

export interface NativeSessionStore {
  load(): Promise<NativeSessionSnapshot | null>;
  save(snapshot: NativeSessionSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export const nativeSessionGuardrails = {
  storageKind: nativeMobileSessionBridgePolicy.storage,
  loginRoute: appRoutes.auth.login,
  meRoute: appRoutes.me,
  logoutRoute: appRoutes.auth.logout,
  disallowedStorage: [...nativeMobileSessionBridgePolicy.disallowedStorage],
  requiredCapabilities: [...nativeMobileSessionBridgePolicy.requiredCapabilities],
  reviewLater: [
    "SSO/IdP 연결 승인",
    "생체인증 사용 여부 결정",
    "push token 과 세션 binding 정책 확정",
  ],
} as const;

export function createLocalVerificationNativeSessionSnapshot(roleCodes: readonly RoleCode[] = ["EMPLOYEE"]) {
  return {
    sessionId: "mobile_local_verification_session",
    status: "authenticated" as const,
    expiresAt: "2099-01-01T00:00:00.000Z",
    companyId: "company_demo",
    employeeId: "employee_demo",
    roleCodes,
    permissions: [
      "attendance.read",
      "leave.request",
      "approval.document.read",
      "board.notice.read",
      "document.space.read",
    ] as const,
    source: "local-verification" as const,
  };
}

export function describeSessionScopedFeatures(roleCodes: readonly RoleCode[]) {
  const canApprove = hasNativeMobileApprovalLaneAccess(roleCodes);

  return {
    attendance: nativeMobilePermissionHints.attendance ?? [],
    leave: nativeMobilePermissionHints.leave ?? [],
    approvals: canApprove ? nativeMobilePermissionHints.approvals ?? [] : ["approval.document.read"],
    collaboration: nativeMobilePermissionHints.collaboration ?? [],
  };
}
