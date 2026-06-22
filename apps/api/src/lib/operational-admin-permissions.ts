import type { AdminFeaturePermissionKey, AdminPermissionState, AdminPermissionUserId, Permission, RoleCode } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

export const adminPermissionRoleByUser: Record<AdminPermissionUserId, RoleCode> = {
  admin: "COMPANY_ADMIN",
  hr_manager: "HR_ADMIN",
  branch_manager: "MANAGER",
  employee: "EMPLOYEE",
};

export const adminFeaturePermissionCodes: Record<AdminFeaturePermissionKey, Permission["code"][]> = {
  attendance: ["attendance.read", "attendance.manage"],
  leave: ["leave.request", "leave.approve"],
  approvals: ["approval.document.read", "approval.document.write", "approval.document.approve", "approval.form.manage", "approval.line.manage"],
  boards: ["board.notice.read", "board.post.write", "board.comment.write", "board.manage"],
  documents: ["document.space.read", "document.file.read", "document.file.write", "document.space.manage"],
  employees: ["employee.read", "employee.write", "department.read"],
  payroll: ["payroll.read", "payroll.manage", "payroll.review", "payroll.payslip.read_self"],
  management: ["work_item.read", "work_item.manage", "work_item.review", "work_item.deadline.read", "work_item.audit.read", "work_item.grievance.read_restricted", "work_item.labor.read_restricted"],
};

const allAdminPermissionUsers = Object.keys(adminPermissionRoleByUser) as AdminPermissionUserId[];
const allAdminFeaturePermissions = Object.keys(adminFeaturePermissionCodes) as AdminFeaturePermissionKey[];

function toIso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildStateFromRolePermissions(rolePermissionCodes: Map<RoleCode, Set<Permission["code"]>>): AdminPermissionState {
  return Object.fromEntries(
    allAdminPermissionUsers.map((userId) => {
      const roleCode = adminPermissionRoleByUser[userId];
      const rolePermissionSet = rolePermissionCodes.get(roleCode) ?? new Set<Permission["code"]>();
      return [
        userId,
        Object.fromEntries(
          allAdminFeaturePermissions.map((featureKey) => {
            const requiredCodes = adminFeaturePermissionCodes[featureKey];
            return [featureKey, requiredCodes.some((code) => rolePermissionSet.has(code))];
          }),
        ),
      ];
    }),
  ) as AdminPermissionState;
}

export async function listOperationalAdminPermissionSettings(
  env: PostgresEnv | undefined,
  companyId: string,
  fallbackForRole: (roleCode: RoleCode) => Permission["code"][],
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const rows = await sql`
      select r.code as role_code, p.code as permission_code, max(rp.created_at) as updated_at
      from roles r
      left join role_permissions rp on rp.role_id = r.id
      left join permissions p on p.id = rp.permission_id
      where (r.company_id = ${companyId} or r.company_id is null)
        and r.status = 'active'
        and r.deleted_at is null
      group by r.code, p.code
    `;

    const rolePermissionCodes = new Map<RoleCode, Set<Permission["code"]>>();
    let updatedAt: string | null = null;
    for (const userId of allAdminPermissionUsers) {
      const roleCode = adminPermissionRoleByUser[userId];
      rolePermissionCodes.set(roleCode, new Set(fallbackForRole(roleCode)));
    }
    for (const row of rows as Array<{ role_code: string; permission_code: string | null; updated_at: string | Date | null }>) {
      const roleCode = row.role_code as RoleCode;
      if (!rolePermissionCodes.has(roleCode)) continue;
      const current = rolePermissionCodes.get(roleCode) ?? new Set<Permission["code"]>();
      if (row.permission_code) current.add(row.permission_code as Permission["code"]);
      rolePermissionCodes.set(roleCode, current);
      const rowUpdatedAt = toIso(row.updated_at);
      if (rowUpdatedAt && (!updatedAt || rowUpdatedAt > updatedAt)) updatedAt = rowUpdatedAt;
    }

    return {
      settings: buildStateFromRolePermissions(rolePermissionCodes),
      updatedAt,
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function saveOperationalAdminPermissionSettings(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  settings: AdminPermissionState,
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const now = new Date().toISOString();

  try {
    await sql`begin`;

    for (const userId of allAdminPermissionUsers) {
      const roleCode = adminPermissionRoleByUser[userId];
      const roleRows = await sql`
        select id from roles
        where code = ${roleCode}
          and (company_id = ${companyId} or company_id is null)
          and status = 'active'
          and deleted_at is null
        order by company_id nulls last
        limit 1
      `;
      const roleId = (roleRows[0] as { id: string } | undefined)?.id;
      if (!roleId) continue;

      for (const featureKey of allAdminFeaturePermissions) {
        const permissionCodes = adminFeaturePermissionCodes[featureKey];
        const enabled = settings[userId][featureKey];
        if (enabled) {
          for (const permissionCode of permissionCodes) {
            await sql`
              insert into role_permissions (id, role_id, permission_id, created_at)
              select ${`role_permission_${roleCode}_${featureKey}_${permissionCode.replaceAll(".", "_")}`}, ${roleId}, id, ${now}
              from permissions
              where code = ${permissionCode}
              on conflict (role_id, permission_id) do nothing
            `;
          }
        } else {
          await sql`
            delete from role_permissions rp
            using permissions p
            where rp.permission_id = p.id
              and rp.role_id = ${roleId}
              and p.code = any(${permissionCodes}::text[])
          `;
        }
      }
    }

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, metadata_json, created_at)
      values (${`audit_admin_permissions_${Date.now()}`}, ${companyId}, ${actorUserId}, 'admin.permissions.update', 'role_permissions', ${companyId}, ${JSON.stringify({ source: "integrated-settings", changedRoles: allAdminPermissionUsers.map((userId) => adminPermissionRoleByUser[userId]) })}::jsonb, ${now})
    `;
    await sql`commit`;

    const saved = await listOperationalAdminPermissionSettings(env, companyId, () => []);
    return {
      settings: saved?.settings ?? settings,
      updatedAt: saved?.updatedAt ?? now,
    };
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
