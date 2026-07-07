import type {
  AdminRegistrationRequestApproveRequest,
  AuthRegistrationRequest,
  AuthRegistrationRequestCreateRequest,
  RoleCode,
  ZitadelRegistrationUserType,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";
import {
  approveRegistration,
  requestRegistration,
  type ZitadelStepUpEnv,
} from "./zitadel-step-up-auth";

export type ZitadelRegistrationEnv = PostgresEnv & ZitadelStepUpEnv;

export type RegistrationServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: "DB_NOT_CONFIGURED" | "EXTERNAL_AUTH_NOT_CONFIGURED" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT"; message: string };

const defaultRoleByUserType: Record<ZitadelRegistrationUserType, RoleCode> = {
  INTERNAL_STAFF: "EMPLOYEE",
  ROOM_OPERATIONS: "EMPLOYEE",
  BRANCH_OWNER: "MANAGER",
  PARTNER_EMPLOYEE: "EMPLOYEE",
};

function isZitadelConfigured(env: ZitadelStepUpEnv | undefined) {
  return Boolean(env?.ZITADEL_API_ENDPOINT?.trim() && env?.ZITADEL_ORG_ID?.trim() && (env?.ZITADEL_SERVICE_ACCOUNT_JSON?.trim() || env?.ZITADEL_ACCESS_TOKEN?.trim()));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeLoginName(loginName: string) {
  return loginName.trim().toLowerCase();
}

function requestId() {
  return `zitadel_reg_${crypto.randomUUID()}`;
}

function localUserId(zitadelUserId: string) {
  return `user_zitadel_${zitadelUserId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function localEmployeeId(zitadelUserId: string) {
  return `employee_zitadel_${zitadelUserId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function employeeNumber() {
  return `ZIT-${Date.now().toString(36).toUpperCase()}`;
}

type RegistrationRow = {
  id: string;
  company_id: string;
  zitadel_user_id: string;
  login_id: string;
  email: string;
  display_name: string;
  user_type: ZitadelRegistrationUserType;
  registration_status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  local_user_id: string | null;
  local_employee_id: string | null;
};

function mapRow(row: RegistrationRow): AuthRegistrationRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    zitadelUserId: row.zitadel_user_id,
    loginName: row.login_id,
    email: row.email,
    displayName: row.display_name,
    userType: row.user_type,
    registrationStatus: row.registration_status,
    requestedAt: new Date(row.requested_at).toISOString(),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    localUserId: row.local_user_id,
    localEmployeeId: row.local_employee_id,
  };
}

const rowSelect = `
  id,
  company_id,
  zitadel_user_id,
  login_id,
  email,
  display_name,
  user_type,
  registration_status,
  requested_at,
  reviewed_by,
  reviewed_at,
  local_user_id,
  local_employee_id
`;

export async function createZitadelRegistrationRequest(
  env: ZitadelRegistrationEnv | undefined,
  input: AuthRegistrationRequestCreateRequest,
): Promise<RegistrationServiceResult<AuthRegistrationRequest>> {
  const sql = createOperationalSql(env);
  if (!sql) {
    return { ok: false, error: "DB_NOT_CONFIGURED", message: "회원가입 요청 저장은 실제 PostgreSQL 연결이 필요합니다." };
  }
  if (!env || !isZitadelConfigured(env)) {
    return { ok: false, error: "EXTERNAL_AUTH_NOT_CONFIGURED", message: "ZITADEL API endpoint/org/service credential 설정이 필요합니다." };
  }

  const companyId = input.companyId.trim();
  const email = normalizeEmail(input.email);
  const loginName = normalizeLoginName(input.loginName);
  const displayName = input.displayName.trim();

  try {
    const companyRows = await sql`
      select id from companies
      where id = ${companyId}
        and status = 'active'
      limit 1
    `;
    if (!companyRows[0]) {
      return { ok: false, error: "VALIDATION_ERROR", message: "활성 회사가 아닙니다." };
    }

    const duplicateRows = await sql`
      select id from users
      where company_id = ${companyId}
        and deleted_at is null
        and (lower(login_id) = ${loginName} or lower(email) = ${email})
      union all
      select id from zitadel_registration_requests
      where company_id = ${companyId}
        and deleted_at is null
        and registration_status in ('PENDING', 'APPROVED')
        and (lower(login_id) = ${loginName} or lower(email) = ${email})
      limit 1
    `;
    if (duplicateRows[0]) {
      return { ok: false, error: "CONFLICT", message: "이미 등록되었거나 승인 대기 중인 계정입니다." };
    }

    const zitadel = await requestRegistration(env, {
      loginName,
      email,
      displayName,
      initialPassword: input.initialPassword,
      userType: input.userType,
    });

    const now = new Date().toISOString();
    const id = requestId();
    const rows = await sql.query(
      `insert into zitadel_registration_requests (
        id, company_id, zitadel_user_id, login_id, email, display_name, user_type, registration_status, requested_at, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9)
      returning ${rowSelect}`,
      [id, companyId, zitadel.userId, loginName, email, displayName, zitadel.userType, zitadel.registrationStatus, now],
    );

    return { ok: true, value: mapRow(rows[0] as RegistrationRow) };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) {
      return { ok: false, error: "DB_NOT_CONFIGURED", message: "회원가입 요청 DB schema가 적용되지 않았습니다." };
    }
    throw error;
  }
}

export async function listZitadelRegistrationRequests(
  env: ZitadelRegistrationEnv | undefined,
  companyId: string,
): Promise<RegistrationServiceResult<AuthRegistrationRequest[]>> {
  const sql = createOperationalSql(env);
  if (!sql) {
    return { ok: false, error: "DB_NOT_CONFIGURED", message: "회원가입 요청 목록 조회는 실제 PostgreSQL 연결이 필요합니다." };
  }

  try {
    const rows = await sql.query(
      `select ${rowSelect}
       from zitadel_registration_requests
       where company_id = $1
         and deleted_at is null
       order by requested_at desc, id desc`,
      [companyId],
    );
    return { ok: true, value: (rows as RegistrationRow[]).map(mapRow) };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) {
      return { ok: false, error: "DB_NOT_CONFIGURED", message: "회원가입 요청 DB schema가 적용되지 않았습니다." };
    }
    throw error;
  }
}

export async function approveZitadelRegistrationRequest(
  env: ZitadelRegistrationEnv | undefined,
  companyId: string,
  actorUserId: string,
  requestIdValue: string,
  input: AdminRegistrationRequestApproveRequest,
): Promise<RegistrationServiceResult<{ request: AuthRegistrationRequest; localUserId: string; localEmployeeId: string | null; assignedRoleCode: RoleCode; updatedAt: string }>> {
  const sql = createOperationalSql(env);
  if (!sql) {
    return { ok: false, error: "DB_NOT_CONFIGURED", message: "회원가입 승인 저장은 실제 PostgreSQL 연결이 필요합니다." };
  }
  if (!env || !isZitadelConfigured(env)) {
    return { ok: false, error: "EXTERNAL_AUTH_NOT_CONFIGURED", message: "ZITADEL API endpoint/org/service credential 설정이 필요합니다." };
  }

  const updatedAt = new Date().toISOString();

  try {
    await sql`begin`;
    const requestRows = await sql.query(
      `select ${rowSelect}
       from zitadel_registration_requests
       where id = $1
         and company_id = $2
         and deleted_at is null
       for update`,
      [requestIdValue, companyId],
    );
    const request = requestRows[0] as RegistrationRow | undefined;
    if (!request) {
      await sql`rollback`;
      return { ok: false, error: "NOT_FOUND", message: "승인 대상 회원가입 요청을 찾을 수 없습니다." };
    }
    if (request.registration_status !== "PENDING") {
      await sql`rollback`;
      return { ok: false, error: "VALIDATION_ERROR", message: "승인 대기 상태의 요청만 승인할 수 있습니다." };
    }

    const roleCode = input.roleCode ?? defaultRoleByUserType[request.user_type];
    const roleRows = await sql`
      select id from roles
      where company_id = ${companyId}
        and code = ${roleCode}
        and status = 'active'
        and deleted_at is null
      limit 1
    `;
    const roleId = (roleRows[0] as { id: string } | undefined)?.id;
    if (!roleId) {
      await sql`rollback`;
      return { ok: false, error: "VALIDATION_ERROR", message: "기본권한 템플릿에 해당하는 역할을 찾을 수 없습니다." };
    }

    let employeeId: string | null = null;
    let branchId: string | null = null;
    let departmentId: string | null = null;
    let positionId: string | null = null;

    if (request.user_type === "INTERNAL_STAFF") {
      if (!input.branchName?.trim() || !input.departmentName?.trim()) {
        await sql`rollback`;
        return { ok: false, error: "VALIDATION_ERROR", message: "사내임직원 승인에는 지점명과 부서명이 필요합니다." };
      }
      const branchRows = await sql`
        select id from branches
        where company_id = ${companyId}
          and name = ${input.branchName.trim()}
          and status = 'active'
          and deleted_at is null
        limit 1
      `;
      branchId = (branchRows[0] as { id: string } | undefined)?.id ?? null;
      const departmentRows = await sql`
        select id from departments
        where company_id = ${companyId}
          and name = ${input.departmentName.trim()}
          and status = 'active'
          and deleted_at is null
        limit 1
      `;
      departmentId = (departmentRows[0] as { id: string } | undefined)?.id ?? null;
      if (!branchId || !departmentId) {
        await sql`rollback`;
        return { ok: false, error: "VALIDATION_ERROR", message: "승인에 사용할 지점 또는 부서를 찾을 수 없습니다." };
      }
      if (input.positionName?.trim()) {
        const positionRows = await sql`
          select id from positions
          where company_id = ${companyId}
            and name = ${input.positionName.trim()}
            and status = 'active'
            and deleted_at is null
          limit 1
        `;
        positionId = (positionRows[0] as { id: string } | undefined)?.id ?? null;
      }
      employeeId = localEmployeeId(request.zitadel_user_id);
    }

    await approveRegistration(env, request.zitadel_user_id);

    const userId = localUserId(request.zitadel_user_id);
    await sql`
      insert into users (id, company_id, login_id, email, password_hash, display_name, status, must_change_password, external_auth_provider, external_auth_user_id, user_type, created_at, updated_at)
      values (${userId}, ${companyId}, ${request.login_id}, ${request.email}, ${`external_auth_zitadel_${crypto.randomUUID()}`}, ${request.display_name}, 'active', false, 'zitadel', ${request.zitadel_user_id}, ${request.user_type}, ${updatedAt}, ${updatedAt})
    `;

    if (employeeId) {
      await sql`
        insert into employees (id, company_id, branch_id, user_id, department_id, position_id, employee_number, full_name, employment_status, hire_date, created_at, updated_at)
        values (${employeeId}, ${companyId}, ${branchId}, ${userId}, ${departmentId}, ${positionId}, ${employeeNumber()}, ${request.display_name}, 'active', current_date, ${updatedAt}, ${updatedAt})
      `;
    }

    await sql`
      insert into user_roles (id, company_id, user_id, role_id, assigned_by, status, created_at, updated_at)
      values (${`user_role_${userId}_${roleCode}`}, ${companyId}, ${userId}, ${roleId}, ${actorUserId}, 'active', ${updatedAt}, ${updatedAt})
    `;

    const updatedRows = await sql.query(
      `update zitadel_registration_requests
       set registration_status = 'APPROVED',
           reviewed_by = $1,
           reviewed_at = $2,
           local_user_id = $3,
           local_employee_id = $4,
           reason = $5,
           updated_at = $2
       where id = $6
         and company_id = $7
       returning ${rowSelect}`,
      [actorUserId, updatedAt, userId, employeeId, input.reason, request.id, companyId],
    );

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${`audit_zitadel_registration_approve_${request.id}_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'auth.registration.approve',
        'user',
        ${userId},
        ${JSON.stringify({ registrationStatus: "PENDING" })}::jsonb,
        ${JSON.stringify({ registrationStatus: "APPROVED", userId, employeeId, roleCode, userType: request.user_type })}::jsonb,
        ${JSON.stringify({ source: "api-admin", category: "user", reason: input.reason, maskedFields: ["password_hash", "initial_password", "session_token_hash"] })}::jsonb,
        ${updatedAt}
      )
    `;

    await sql`commit`;
    const mapped = mapRow(updatedRows[0] as RegistrationRow);
    return { ok: true, value: { request: mapped, localUserId: userId, localEmployeeId: employeeId, assignedRoleCode: roleCode, updatedAt } };
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) {
      return { ok: false, error: "DB_NOT_CONFIGURED", message: "회원가입 요청 DB schema가 적용되지 않았습니다." };
    }
    throw error;
  }
}
