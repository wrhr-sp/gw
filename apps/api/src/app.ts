import { Hono, type Context } from "hono";
import {
  appRoutes,
  authLoginRequestSchema,
  authLoginResponseSchema,
  authLogoutResponseSchema,
  createInviteRequestSchema,
  createInviteResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  listCompaniesResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  meResponseSchema,
  type ErrorCode,
  type Permission,
  type Session,
  type SessionUser,
} from "@gw/shared";

const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const DEV_SESSION_MAX_AGE_SECONDS = 60 * 60;
const COMPANY_ID = "company_demo";
const SESSION_EXPIRY = "2099-01-01T00:00:00.000Z";

const permissionCatalog: Permission[] = [
  { code: "company.read", description: "회사 기본 정보를 조회한다." },
  { code: "employee.read", description: "직원 기본 정보와 인사 상태를 조회한다." },
  { code: "employee.write", description: "직원 정보 변경 API 확장을 위한 권한 골격이다." },
  { code: "department.read", description: "조직도와 부서 구조를 조회한다." },
  { code: "role.read", description: "역할 목록과 역할 설명을 조회한다." },
  { code: "permission.read", description: "권한 코드 카탈로그를 조회한다." },
  { code: "invite.manage", description: "관리자 초대와 권한 부여를 관리한다." },
  { code: "audit.read", description: "감사 로그 열람 확장을 위한 시작 권한이다." },
];

const rolePermissions = {
  SUPER_ADMIN: permissionCatalog.map((permission) => permission.code),
  COMPANY_ADMIN: ["company.read", "employee.read", "employee.write", "department.read", "role.read", "permission.read", "invite.manage", "audit.read"],
  HR_ADMIN: ["company.read", "employee.read", "employee.write", "department.read", "role.read", "permission.read"],
  MANAGER: ["company.read", "employee.read", "department.read", "role.read"],
  EMPLOYEE: ["company.read"],
  AUDITOR: ["company.read", "employee.read", "department.read", "role.read", "permission.read", "audit.read"],
} as const;

type RoleCode = keyof typeof rolePermissions;

const companies = [
  { id: COMPANY_ID, code: "demo", name: "데모 주식회사", status: "active" as const },
];

const departments = [
  { id: "department_exec", companyId: COMPANY_ID, parentDepartmentId: null, code: "EXEC", name: "경영지원", status: "active" as const },
  { id: "department_ops", companyId: COMPANY_ID, parentDepartmentId: "department_exec", code: "OPS", name: "운영팀", status: "active" as const },
  { id: "department_hr", companyId: COMPANY_ID, parentDepartmentId: "department_exec", code: "HR", name: "인사팀", status: "active" as const },
];

const employees = [
  { id: "employee_admin", companyId: COMPANY_ID, departmentId: "department_exec", email: "admin@example.com", fullName: "관리자 테스트", employmentStatus: "active" as const },
  { id: "employee_manager", companyId: COMPANY_ID, departmentId: "department_ops", email: "manager@example.com", fullName: "운영 매니저", employmentStatus: "active" as const },
  { id: "employee_staff", companyId: COMPANY_ID, departmentId: "department_hr", email: "staff@example.com", fullName: "인사 담당자", employmentStatus: "on_leave" as const },
];

const roles = (Object.keys(rolePermissions) as RoleCode[]).map((code) => ({
  code,
  name: code.replaceAll("_", " "),
  scope: code === "SUPER_ADMIN" ? ("global" as const) : ("company" as const),
  permissions: [...rolePermissions[code]],
}));

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
  const employeeId = roleCode === "MANAGER" ? "employee_manager" : roleCode === "HR_ADMIN" ? "employee_staff" : "employee_admin";
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

function requirePermission(context: Context, permission: Permission["code"]): AuthorizationResult {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult;
  }

  if (!authResult.auth.user.permissions.includes(permission)) {
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
