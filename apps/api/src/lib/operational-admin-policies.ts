import type { AdminPolicyBoardUpdateRequest, AdminPolicyDocumentUpdateRequest, AdminPolicySummary } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

function toIso(value: string | Date | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function saveOperationalDocumentPolicy(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  request: AdminPolicyDocumentUpdateRequest,
): Promise<AdminPolicySummary | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  const updatedAt = new Date().toISOString();
  const settings = {
    visibility: request.visibility,
    maxFileSizeBytes: request.maxFileSizeBytes,
    allowedFileExtensions: request.allowedFileExtensions,
    retentionDays: request.retentionDays,
  };

  try {
    await sql`begin`;
    await sql`
      insert into admin_policy_settings (id, company_id, category, settings_json, reason, updated_by, created_at, updated_at)
      values (${`admin_policy_document_${companyId}`}, ${companyId}, 'document', ${JSON.stringify(settings)}::jsonb, ${request.reason}, ${actorUserId}, ${updatedAt}, ${updatedAt})
      on conflict (company_id, category) do update
      set settings_json = excluded.settings_json,
          reason = excluded.reason,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
    `;
    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_policy_document_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.policy.document.updated',
        'policy_documents',
        ${companyId},
        ${JSON.stringify(settings)}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "policy", reason: request.reason, maskedFields: ["storageKey", "signed URL", "secret"] })}::jsonb,
        ${updatedAt}
      )
    `;
    await sql`commit`;

    return {
      category: "document",
      companyId,
      summary: `문서 visibility=${request.visibility}, retention=${request.retentionDays}일 정책 저장`,
      lastReviewedAt: updatedAt,
      policyChecks: [
        `허용 확장자: ${request.allowedFileExtensions.join(", ")}`,
        `최대 파일 크기: ${request.maxFileSizeBytes} bytes`,
        "운영 DB admin_policy_settings 저장 완료",
      ],
      capability: "document.space.manage",
      reasonRequired: true,
      diffSummary: {
        before: "운영 DB 저장 전 정책",
        after: `visibility=${request.visibility}, retention=${request.retentionDays}`,
      },
    };
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function saveOperationalBoardPolicy(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  request: AdminPolicyBoardUpdateRequest,
): Promise<AdminPolicySummary | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  const updatedAt = new Date().toISOString();
  const settings = {
    visibility: request.visibility,
    allowAnonymousComments: request.allowAnonymousComments,
    requireReadReceipt: request.requireReadReceipt,
    retentionDays: request.retentionDays,
  };

  try {
    await sql`begin`;
    await sql`
      insert into admin_policy_settings (id, company_id, category, settings_json, reason, updated_by, created_at, updated_at)
      values (${`admin_policy_board_${companyId}`}, ${companyId}, 'board', ${JSON.stringify(settings)}::jsonb, ${request.reason}, ${actorUserId}, ${updatedAt}, ${updatedAt})
      on conflict (company_id, category) do update
      set settings_json = excluded.settings_json,
          reason = excluded.reason,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
    `;
    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_policy_board_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.policy.board.updated',
        'policy_boards',
        ${companyId},
        ${JSON.stringify(settings)}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "board", reason: request.reason, maskedFields: ["restricted board metadata"] })}::jsonb,
        ${updatedAt}
      )
    `;
    await sql`commit`;

    return {
      category: "board",
      companyId,
      summary: `게시판 visibility=${request.visibility}, readReceipt=${request.requireReadReceipt ? "required" : "optional"} 정책 저장`,
      lastReviewedAt: toIso(updatedAt),
      policyChecks: [
        `익명 댓글: ${request.allowAnonymousComments ? "허용" : "차단"}`,
        `읽음 확인: ${request.requireReadReceipt ? "필수" : "선택"}`,
        "운영 DB admin_policy_settings 저장 완료",
      ],
      capability: "board.manage",
      reasonRequired: true,
      diffSummary: {
        before: "운영 DB 저장 전 정책",
        after: `visibility=${request.visibility}, retention=${request.retentionDays}`,
      },
    };
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
