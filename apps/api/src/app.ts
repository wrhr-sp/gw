import { Hono, type Context } from "hono";
import {
  appRoutes,
  attendanceActionResponseSchema,
  attendanceCorrectionRequestSchema,
  attendanceCorrectionResponseSchema,
  attendanceListRecordsResponseSchema,
  authLoginRequestSchema,
  authLoginResponseSchema,
  authLogoutResponseSchema,
  createInviteRequestSchema,
  createInviteResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  leaveActionRequestSchema,
  leaveActionResponseSchema,
  leaveBalanceListResponseSchema,
  leaveRequestCreateRequestSchema,
  leaveRequestCreateResponseSchema,
  leaveRequestListResponseSchema,
  leaveTypeListResponseSchema,
  listCompaniesResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  meResponseSchema,
  type AttendanceRecord,
  type ErrorCode,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Permission,
  type Session,
  type SessionUser,
} from "@gw/shared";

const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const DEV_SESSION_MAX_AGE_SECONDS = 60 * 60;
const COMPANY_ID = "company_demo";
const SESSION_EXPIRY = "2099-01-01T00:00:00.000Z";
const PLACEHOLDER_NOW = "2026-06-10T09:00:00.000Z";
const PLACEHOLDER_CHECK_OUT = "2026-06-10T18:00:00.000Z";
const PLACEHOLDER_REVIEWED_AT = "2026-06-10T10:00:00.000Z";
const PLACEHOLDER_WORK_DATE = "2026-06-10";
const LEAVE_REQUEST_APPROVE_ROUTE = "/api/leave/requests/:id/approve";
const LEAVE_REQUEST_REJECT_ROUTE = "/api/leave/requests/:id/reject";

const permissionCatalog: Permission[] = [
  { code: "company.read", description: "회사 기본 정보를 조회한다." },
  { code: "employee.read", description: "직원 기본 정보와 인사 상태를 조회한다." },
  { code: "employee.write", description: "직원 정보 변경 API 확장을 위한 권한 골격이다." },
  { code: "department.read", description: "조직도와 부서 구조를 조회한다." },
  { code: "role.read", description: "역할 목록과 역할 설명을 조회한다." },
  { code: "permission.read", description: "권한 코드 카탈로그를 조회한다." },
  { code: "invite.manage", description: "관리자 초대와 권한 부여를 관리한다." },
  { code: "audit.read", description: "감사 로그 열람 확장을 위한 시작 권한이다." },
  { code: "attendance.read", description: "본인 근태 기록 조회와 출퇴근 placeholder 흐름을 사용한다." },
  { code: "attendance.manage", description: "근태 정정 검토와 관리자 조회 확장을 위한 권한 골격이다." },
  { code: "leave.request", description: "휴가 유형/잔여 조회와 휴가 신청 placeholder 흐름을 사용한다." },
  { code: "leave.approve", description: "휴가 승인/반려 placeholder 흐름을 처리한다." },
];

const rolePermissions = {
  SUPER_ADMIN: permissionCatalog.map((permission) => permission.code),
  COMPANY_ADMIN: [
    "company.read",
    "employee.read",
    "employee.write",
    "department.read",
    "role.read",
    "permission.read",
    "invite.manage",
    "audit.read",
    "attendance.read",
    "attendance.manage",
    "leave.request",
    "leave.approve",
  ],
  HR_ADMIN: [
    "company.read",
    "employee.read",
    "employee.write",
    "department.read",
    "role.read",
    "permission.read",
    "attendance.read",
    "attendance.manage",
    "leave.request",
    "leave.approve",
  ],
  MANAGER: [
    "company.read",
    "employee.read",
    "department.read",
    "role.read",
    "attendance.read",
    "attendance.manage",
    "leave.request",
    "leave.approve",
  ],
  EMPLOYEE: ["company.read", "attendance.read", "leave.request"],
  AUDITOR: ["company.read", "employee.read", "department.read", "role.read", "permission.read", "audit.read", "attendance.read"],
} as const;

type RoleCode = keyof typeof rolePermissions;

const companies = [{ id: COMPANY_ID, code: "demo", name: "데모 주식회사", status: "active" as const }];

const departments = [
  { id: "department_exec", companyId: COMPANY_ID, parentDepartmentId: null, code: "EXEC", name: "경영지원", status: "active" as const },
  { id: "department_ops", companyId: COMPANY_ID, parentDepartmentId: "department_exec", code: "OPS", name: "운영팀", status: "active" as const },
  { id: "department_hr", companyId: COMPANY_ID, parentDepartmentId: "department_exec", code: "HR", name: "인사팀", status: "active" as const },
];

const employees = [
  { id: "employee_admin", companyId: COMPANY_ID, departmentId: "department_exec", email: "admin@example.com", fullName: "관리자 테스트", employmentStatus: "active" as const },
  { id: "employee_manager", companyId: COMPANY_ID, departmentId: "department_ops", email: "manager@example.com", fullName: "운영 매니저", employmentStatus: "active" as const },
  { id: "employee_staff", companyId: COMPANY_ID, departmentId: "department_hr", email: "staff@example.com", fullName: "인사 담당자", employmentStatus: "on_leave" as const },
  { id: "employee_employee", companyId: COMPANY_ID, departmentId: "department_ops", email: "employee@example.com", fullName: "일반 구성원", employmentStatus: "active" as const },
];

const roleEmployeeIds: Partial<Record<RoleCode, string>> = {
  COMPANY_ADMIN: "employee_admin",
  HR_ADMIN: "employee_staff",
  MANAGER: "employee_manager",
  EMPLOYEE: "employee_employee",
};

const roles = (Object.keys(rolePermissions) as RoleCode[]).map((code) => ({
  code,
  name: code.replaceAll("_", " "),
  scope: code === "SUPER_ADMIN" ? ("global" as const) : ("company" as const),
  permissions: [...rolePermissions[code]],
}));

const leaveTypes: LeaveType[] = [
  { id: "leave_type_annual", companyId: COMPANY_ID, code: "annual", name: "연차", unit: "day", status: "active", placeholder: true },
  { id: "leave_type_half_day_am", companyId: COMPANY_ID, code: "half_day_am", name: "반차(오전)", unit: "half_day", status: "active", placeholder: true },
  { id: "leave_type_sick", companyId: COMPANY_ID, code: "sick", name: "병가", unit: "day", status: "active", placeholder: true },
];

export const app = new Hono();

function jsonSuccess<T>(context: Context, schema: { parse: (value: unknown) => T }, payload: unknown, status: 200 | 201 = 200) {
  return context.json(schema.parse(payload), status);
}

function jsonError(
  context: Context,
  code: ErrorCode,
  message: string,
  status: 400 | 401 | 403 | 501,
  details?: Record<string, unknown>,
) {
  return context.json(
    errorResponseSchema.parse({
      ok: false,
      data: null,
      error: {
        code,
        message,
        details,
      },
    }),
    status,
  );
}

function resolveRoleCode(rawRole: string | undefined): RoleCode {
  return rawRole && rawRole in rolePermissions ? (rawRole as RoleCode) : "COMPANY_ADMIN";
}

function buildSession(roleCode: RoleCode): Session {
  return {
    id: `${DEV_SESSION_PREFIX}${roleCode}`,
    status: "authenticated",
    expiresAt: SESSION_EXPIRY,
    placeholder: true,
  };
}

function buildUser(roleCode: RoleCode, email = "admin@example.com"): SessionUser {
  const employeeId = roleEmployeeIds[roleCode] ?? "employee_admin";
  const employee = employees.find((item) => item.id === employeeId) ?? employees[0];

  return {
    id: `user_${roleCode.toLowerCase()}`,
    companyId: COMPANY_ID,
    employeeId: employee.id,
    email,
    fullName: employee.fullName,
    roleCodes: [roleCode],
    permissions: [...rolePermissions[roleCode]],
  };
}

function extractRoleCode(cookieHeader: string | null): RoleCode | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(/gw_session=([^;]+)/);
  if (!match) {
    return null;
  }

  const sessionToken = decodeURIComponent(match[1]);
  if (!sessionToken.startsWith(DEV_SESSION_PREFIX)) {
    return null;
  }

  const candidate = sessionToken.slice(DEV_SESSION_PREFIX.length);
  return candidate in rolePermissions ? (candidate as RoleCode) : null;
}

type SessionContext = {
  roleCode: RoleCode;
  session: Session;
  user: SessionUser;
};

type AuthorizationResult =
  | { auth: SessionContext; response?: never }
  | { auth?: never; response: Response };

function requireSession(context: Context): SessionContext | null {
  const roleCode = extractRoleCode(context.req.header("cookie") ?? null);
  if (!roleCode) {
    return null;
  }

  return {
    roleCode,
    session: buildSession(roleCode),
    user: buildUser(roleCode),
  };
}

function requireAuth(context: Context): AuthorizationResult {
  const auth = requireSession(context);
  if (auth === null) {
    return {
      response: jsonError(context, "AUTH_REQUIRED", "로그인이 필요합니다.", 401, { route: context.req.path }),
    };
  }

  return { auth };
}

function hasPermission(user: SessionUser, permission: Permission["code"]) {
  return user.permissions.includes(permission);
}

function requirePermission(context: Context, permission: Permission["code"]): AuthorizationResult {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult;
  }

  if (!hasPermission(authResult.auth.user, permission)) {
    return {
      response: jsonError(context, "FORBIDDEN", "필요한 권한이 없습니다.", 403, {
        requiredPermission: permission,
        roleCodes: authResult.auth.user.roleCodes,
        route: context.req.path,
      }),
    };
  }

  return authResult;
}

function requireAnyPermission(context: Context, permissions: Permission["code"][]): AuthorizationResult {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult;
  }

  if (!permissions.some((permission) => hasPermission(authResult.auth.user, permission))) {
    return {
      response: jsonError(context, "FORBIDDEN", "필요한 권한이 없습니다.", 403, {
        requiredAnyPermission: permissions,
        roleCodes: authResult.auth.user.roleCodes,
        route: context.req.path,
      }),
    };
  }

  return authResult;
}

function buildAttendanceRecord(employeeId: string, status: AttendanceRecord["status"]): AttendanceRecord {
  return {
    id: "attendance_record_today",
    companyId: COMPANY_ID,
    employeeId,
    status,
    workDate: PLACEHOLDER_WORK_DATE,
    checkInAt: PLACEHOLDER_NOW,
    checkOutAt: status === "checked_out" ? PLACEHOLDER_CHECK_OUT : null,
    source: "web",
    note: status === "checked_in" ? "placeholder check-in" : "placeholder day",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: status === "checked_out" ? PLACEHOLDER_CHECK_OUT : PLACEHOLDER_NOW,
  };
}

function buildAttendanceRecordsForEmployee(employeeId: string): AttendanceRecord[] {
  return [
    buildAttendanceRecord(employeeId, "checked_out"),
    {
      id: "attendance_record_pending_correction",
      companyId: COMPANY_ID,
      employeeId,
      status: "needs_correction",
      workDate: "2026-06-09",
      checkInAt: "2026-06-09T09:05:00.000Z",
      checkOutAt: null,
      source: "web",
      note: "퇴근 누락 placeholder",
      createdAt: "2026-06-09T09:05:00.000Z",
      updatedAt: "2026-06-09T18:01:00.000Z",
    },
  ];
}

function findEmployeeById(employeeId: string) {
  return employees.find((employee) => employee.id === employeeId) ?? null;
}

function resolveAttendanceEmployeeId(auth: SessionContext, requestedEmployeeId: string | undefined): string | null {
  if (!requestedEmployeeId || !hasPermission(auth.user, "attendance.manage")) {
    return auth.user.employeeId;
  }

  const requestedEmployee = findEmployeeById(requestedEmployeeId);
  if (!requestedEmployee || requestedEmployee.companyId !== auth.user.companyId) {
    return null;
  }

  return requestedEmployee.id;
}

function buildLeaveBalances(employeeId: string): LeaveBalance[] {
  return [
    {
      id: "leave_balance_annual",
      companyId: COMPANY_ID,
      employeeId,
      leaveTypeId: "leave_type_annual",
      asOfDate: "2026-06-01",
      openingDays: 15,
      usedDays: 3,
      reservedDays: 1,
      remainingDays: 11,
      placeholder: true,
    },
    {
      id: "leave_balance_sick",
      companyId: COMPANY_ID,
      employeeId,
      leaveTypeId: "leave_type_sick",
      asOfDate: "2026-06-01",
      openingDays: 10,
      usedDays: 0,
      reservedDays: 0,
      remainingDays: 10,
      placeholder: true,
    },
  ];
}

function buildLeaveRequests(auth: SessionContext): LeaveRequest[] {
  const selfOwnedRequest: LeaveRequest = {
    id: "leave_request_demo",
    companyId: COMPANY_ID,
    employeeId: auth.user.employeeId,
    leaveTypeId: "leave_type_annual",
    status: "pending_approval",
    approvalStatus: "pending",
    startDate: "2026-06-20",
    endDate: "2026-06-20",
    unit: "day",
    days: 1,
    reason: "가족 행사",
    requestedBy: auth.user.id,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  };

  const approverReviewableRequests: LeaveRequest[] = hasPermission(auth.user, "leave.approve")
    ? [
        {
          id: "leave_request_team_pending",
          companyId: COMPANY_ID,
          employeeId: "employee_employee",
          leaveTypeId: "leave_type_half_day_am",
          status: "pending_approval",
          approvalStatus: "pending",
          startDate: "2026-06-21",
          endDate: "2026-06-21",
          unit: "half_day",
          days: 0.5,
          reason: "병원 방문",
          requestedBy: "user_employee",
          reviewedBy: null,
          reviewedAt: null,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
        },
      ]
    : [];

  return [
    selfOwnedRequest,
    ...approverReviewableRequests,
  ];
}

function findReviewableLeaveRequest(auth: SessionContext, leaveRequestId: string) {
  return (
    buildLeaveRequests(auth).find(
      (request) =>
        request.id === leaveRequestId &&
        request.companyId === auth.user.companyId &&
        request.requestedBy !== auth.user.id &&
        request.employeeId !== auth.user.employeeId,
    ) ?? null
  );
}

app.get(appRoutes.health, (context) => {
  return jsonSuccess(
    context,
    healthResponseSchema,
    {
      ok: true,
      data: {
        service: "gw-api",
        status: "ok",
        version: "0.1.0",
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.auth.login, async (context) => {
  const body = await context.req.json().catch(() => null);
  const parsed = authLoginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "로그인 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const roleCode = resolveRoleCode(context.req.header("x-dev-role") ?? undefined);
  const session = buildSession(roleCode);
  const payload = {
    ok: true,
    data: {
      session,
      user: buildUser(roleCode, parsed.data.email),
      nextStep: "Connect real auth provider after approval.",
    },
    error: null,
  };

  context.header(
    "Set-Cookie",
    `gw_session=${encodeURIComponent(session.id)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${DEV_SESSION_MAX_AGE_SECONDS}`,
  );

  return jsonSuccess(context, authLoginResponseSchema, payload, 200);
});

app.post(appRoutes.auth.logout, (context) => {
  context.header("Set-Cookie", "gw_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");

  return jsonSuccess(
    context,
    authLogoutResponseSchema,
    {
      ok: true,
      data: {
        session: {
          status: "signed_out",
          placeholder: true,
        },
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.me, (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    meResponseSchema,
    {
      ok: true,
      data: {
        session: authResult.auth.session,
        user: authResult.auth.user,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.companies, (context) => {
  const authResult = requirePermission(context, "company.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, listCompaniesResponseSchema, { ok: true, data: { items: companies }, error: null }, 200);
});

app.get(appRoutes.org.employees, (context) => {
  const authResult = requirePermission(context, "employee.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    listEmployeesResponseSchema,
    {
      ok: true,
      data: {
        items: employees.filter((employee) => employee.companyId === authResult.auth.user.companyId),
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.departments, (context) => {
  const authResult = requirePermission(context, "department.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    listDepartmentsResponseSchema,
    {
      ok: true,
      data: {
        items: departments.filter((department) => department.companyId === authResult.auth.user.companyId),
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.roles, (context) => {
  const authResult = requirePermission(context, "role.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, listRolesResponseSchema, { ok: true, data: { items: roles }, error: null }, 200);
});

app.get(appRoutes.org.permissions, (context) => {
  const authResult = requirePermission(context, "permission.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, listPermissionsResponseSchema, { ok: true, data: { items: permissionCatalog }, error: null }, 200);
});

app.post(appRoutes.admin.invites, async (context) => {
  const authResult = requirePermission(context, "invite.manage");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = createInviteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "초대 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    createInviteResponseSchema,
    {
      ok: true,
      data: {
        id: `invite_${parsed.data.roleCode.toLowerCase()}`,
        companyId: parsed.data.companyId,
        email: parsed.data.email,
        roleCode: parsed.data.roleCode,
        departmentId: parsed.data.departmentId ?? null,
        status: "pending_delivery",
        expiresAt: SESSION_EXPIRY,
        placeholder: true,
        audit: {
          candidate: true,
          action: "admin.invite.create",
        },
      },
      error: null,
    },
    201,
  );
});

app.post(appRoutes.attendance.checkIn, (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    attendanceActionResponseSchema,
    {
      ok: true,
      data: {
        record: buildAttendanceRecord(authResult.auth.user.employeeId, "checked_in"),
        audit: {
          candidate: true,
          action: "attendance.check_in",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.post(appRoutes.attendance.checkOut, (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    attendanceActionResponseSchema,
    {
      ok: true,
      data: {
        record: buildAttendanceRecord(authResult.auth.user.employeeId, "checked_out"),
        audit: {
          candidate: true,
          action: "attendance.check_out",
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.attendance.records, (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  const requestedEmployeeId = context.req.query("employeeId");
  const employeeId = resolveAttendanceEmployeeId(authResult.auth, requestedEmployeeId);

  if (employeeId === null) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 직원 범위를 조회할 수 없습니다.", 403, {
      employeeId: requestedEmployeeId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    attendanceListRecordsResponseSchema,
    {
      ok: true,
      data: {
        items: buildAttendanceRecordsForEmployee(employeeId),
        filters: {
          employeeId,
          workDateFrom: context.req.query("workDateFrom") ?? undefined,
          workDateTo: context.req.query("workDateTo") ?? undefined,
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.attendance.corrections, async (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = attendanceCorrectionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "근태 정정 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    attendanceCorrectionResponseSchema,
    {
      ok: true,
      data: {
        request: {
          id: "attendance_correction_demo",
          companyId: authResult.auth.user.companyId,
          employeeId: authResult.auth.user.employeeId,
          attendanceRecordId: parsed.data.attendanceRecordId,
          status: "requested",
          requestedBy: authResult.auth.user.id,
          reviewedBy: null,
          reviewedAt: null,
          reason: parsed.data.reason,
          requestedCheckInAt: parsed.data.requestedCheckInAt ?? null,
          requestedCheckOutAt: parsed.data.requestedCheckOutAt ?? null,
          note: parsed.data.note ?? null,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
        },
        audit: {
          candidate: true,
          action: "attendance.correction.request",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.get(appRoutes.leave.types, (context) => {
  const authResult = requireAnyPermission(context, ["leave.request", "leave.approve"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    leaveTypeListResponseSchema,
    {
      ok: true,
      data: {
        items: leaveTypes,
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.leave.balances, (context) => {
  const authResult = requireAnyPermission(context, ["leave.request", "leave.approve"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    leaveBalanceListResponseSchema,
    {
      ok: true,
      data: {
        items: buildLeaveBalances(authResult.auth.user.employeeId),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.leave.requests, (context) => {
  const authResult = requireAnyPermission(context, ["leave.request", "leave.approve"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    leaveRequestListResponseSchema,
    {
      ok: true,
      data: {
        items: buildLeaveRequests(authResult.auth),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.leave.requests, async (context) => {
  const authResult = requirePermission(context, "leave.request");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = leaveRequestCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "휴가 신청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    leaveRequestCreateResponseSchema,
    {
      ok: true,
      data: {
        request: {
          id: "leave_request_demo",
          companyId: authResult.auth.user.companyId,
          employeeId: authResult.auth.user.employeeId,
          leaveTypeId: parsed.data.leaveTypeId,
          status: "pending_approval",
          approvalStatus: "pending",
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          unit: parsed.data.unit,
          days: parsed.data.days,
          reason: parsed.data.reason,
          requestedBy: authResult.auth.user.id,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
        },
        audit: {
          candidate: true,
          action: "leave.request.create",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

async function handleLeaveReview(context: Context, approvalStatus: LeaveRequest["approvalStatus"], action: "leave.request.approve" | "leave.request.reject") {
  const authResult = requirePermission(context, "leave.approve");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = leaveActionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "휴가 승인 처리 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const leaveRequestId = context.req.param("id");
  if (!leaveRequestId) {
    return jsonError(context, "VALIDATION_ERROR", "휴가 요청 식별자가 필요합니다.", 400, {
      route: context.req.path,
    });
  }

  const leaveRequest = findReviewableLeaveRequest(authResult.auth, leaveRequestId);

  if (!leaveRequest) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 휴가 요청을 처리할 수 없습니다.", 403, {
      requestId: leaveRequestId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    leaveActionResponseSchema,
    {
      ok: true,
      data: {
        request: {
          ...leaveRequest,
          status: approvalStatus === "approved" ? "approved" : "rejected",
          approvalStatus,
          reason: parsed.data.reason,
          reviewedBy: authResult.auth.user.id,
          reviewedAt: PLACEHOLDER_REVIEWED_AT,
          updatedAt: PLACEHOLDER_REVIEWED_AT,
        },
        audit: {
          candidate: true,
          action,
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
}

app.post(LEAVE_REQUEST_APPROVE_ROUTE, (context) => handleLeaveReview(context, "approved", "leave.request.approve"));
app.post(LEAVE_REQUEST_REJECT_ROUTE, (context) => handleLeaveReview(context, "rejected", "leave.request.reject"));
