import type { Permission, RoleCode, SessionUser } from "@gw/shared";
import { permissionCodeSchema } from "@gw/shared";
import { createOperationalSql, type PostgresEnv } from "./postgres";

export type OperationalLoginInput = {
  loginId?: string;
  email?: string;
  password: string;
};

export type OperationalLoginResult = {
  user: SessionUser;
  primaryRoleCode: RoleCode;
} | null;

const roleCodes = new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "AUDITOR"]);

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(digest);
}

async function verifyPassword(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) {
    return false;
  }

  const [algorithm, salt, expectedHash] = passwordHash.split(":");
  if (algorithm !== "sha256" || !salt || !expectedHash) {
    return false;
  }

  const actualHash = await sha256Hex(`${salt}:${password}`);
  return actualHash === expectedHash;
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function parseRoleCodes(value: unknown): RoleCode[] {
  if (!Array.isArray(value)) {
    return ["EMPLOYEE"];
  }

  const parsed = value.filter((item): item is RoleCode => typeof item === "string" && roleCodes.has(item as RoleCode));
  return parsed.length > 0 ? parsed : ["EMPLOYEE"];
}

function parsePermissionCodes(value: unknown): Permission["code"][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => permissionCodeSchema.safeParse(item))
    .filter((result): result is { success: true; data: Permission["code"] } => result.success)
    .map((result) => result.data);
}

export async function authenticateOperationalUser(
  env: PostgresEnv | undefined,
  input: OperationalLoginInput,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
): Promise<OperationalLoginResult> {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const loginId = normalize(input.loginId);
  const email = normalize(input.email);
  if (!loginId && !email) {
    return null;
  }

  const rows = await sql`
    select
      u.id as user_id,
      u.company_id,
      coalesce(e.id, '') as employee_id,
      u.email,
      coalesce(e.full_name, u.display_name) as full_name,
      u.password_hash,
      coalesce(json_agg(distinct r.code) filter (where r.code is not null), '[]'::json) as role_codes,
      coalesce(json_agg(distinct p.code) filter (where p.code is not null), '[]'::json) as permission_codes
    from users u
    left join employees e on e.user_id = u.id and e.company_id = u.company_id
    left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active'
    left join roles r on r.id = ur.role_id and r.company_id = ur.company_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id
    left join permissions p on p.id = rp.permission_id
    where u.status = 'active'
      and (
        (${loginId} <> '' and lower(u.login_id) = ${loginId})
        or (${email} <> '' and lower(u.email) = ${email})
      )
    group by u.id, u.company_id, e.id, u.email, e.full_name, u.display_name, u.password_hash
    limit 1
  `;

  const row = rows[0] as
    | {
        user_id: string;
        company_id: string;
        employee_id: string;
        email: string;
        full_name: string;
        password_hash: string;
        role_codes: unknown;
        permission_codes: unknown;
      }
    | undefined;

  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    return null;
  }

  const parsedRoleCodes = parseRoleCodes(row.role_codes);
  const dbPermissionCodes = parsePermissionCodes(row.permission_codes);
  const permissions = dbPermissionCodes.length > 0 ? dbPermissionCodes : [...new Set(parsedRoleCodes.flatMap((roleCode) => permissionsForRole(roleCode)))];

  return {
    primaryRoleCode: parsedRoleCodes[0] ?? "EMPLOYEE",
    user: {
      id: row.user_id,
      companyId: row.company_id,
      employeeId: row.employee_id || row.user_id,
      email: row.email,
      fullName: row.full_name,
      roleCodes: parsedRoleCodes,
      permissions,
    },
  };
}
