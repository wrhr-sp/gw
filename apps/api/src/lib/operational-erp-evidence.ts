import type { ErpEvidence, ErpEvidenceCreateRequest, ErpEvidenceStatus, ErpEvidenceUpdateRequest } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ERP_EVIDENCE_SOURCE = "postgres-r2" as const;

type ErpEvidenceRow = {
  id: string;
  company_id: string;
  expense_id: string | null;
  expense_title: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  file_id: string;
  file_name: string | null;
  evidence_type: ErpEvidence["evidenceType"];
  title: string;
  issued_at: string | Date | null;
  supply_amount: string | number | null;
  tax_amount: string | number | null;
  total_amount: string | number | null;
  status: ErpEvidenceStatus;
  rework_reason: string | null;
  memo: string | null;
  sync_status: ErpEvidence["syncStatus"];
  external_provider: "kyungrinara" | null;
  external_reference_id: string | null;
  last_synced_at: string | Date | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toRequiredIsoString(value: string | Date) {
  return toIsoString(value) ?? new Date(0).toISOString();
}

function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function blankToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toNullableNumber(value: string | number | null) {
  if (value === null) return null;
  return typeof value === "number" ? value : Number(value);
}

function mapEvidence(row: ErpEvidenceRow): ErpEvidence {
  return {
    id: row.id,
    companyId: row.company_id,
    expenseId: row.expense_id,
    expenseTitle: row.expense_title,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    fileId: row.file_id,
    fileName: row.file_name,
    evidenceType: row.evidence_type,
    title: row.title,
    issuedAt: toIsoDate(row.issued_at),
    supplyAmount: toNullableNumber(row.supply_amount),
    taxAmount: toNullableNumber(row.tax_amount),
    totalAmount: toNullableNumber(row.total_amount),
    status: row.status,
    reworkReason: row.rework_reason,
    memo: row.memo,
    syncStatus: row.sync_status,
    externalProvider: row.external_provider,
    externalReferenceId: row.external_reference_id,
    lastSyncedAt: toIsoString(row.last_synced_at),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const evidenceSelect = `
  select ev.id, ev.company_id, ev.expense_id, ex.title as expense_title, ev.vendor_id, v.name as vendor_name,
    ev.file_id, f.file_name, ev.evidence_type, ev.title, ev.issued_at, ev.supply_amount,
    ev.tax_amount, ev.total_amount, ev.status, ev.rework_reason, ev.memo, ev.sync_status,
    ev.external_provider, ev.external_reference_id, ev.last_synced_at, ev.created_by_user_id,
    ev.updated_by_user_id, ev.created_at, ev.updated_at
  from erp_evidence ev
  left join erp_expense_requests ex on ex.id = ev.expense_id and ex.company_id = ev.company_id and ex.deleted_at is null
  left join erp_vendors v on v.id = ev.vendor_id and v.company_id = ev.company_id and v.deleted_at is null
  left join file_objects f on f.id = ev.file_id and f.company_id = ev.company_id and f.deleted_at is null
`;

export async function listOperationalErpEvidence(env: PostgresEnv | undefined, companyId: string, status?: ErpEvidenceStatus) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (status) {
      const rows = await sql.query(
        `${evidenceSelect} where ev.company_id = $1 and ev.status = $2 and ev.deleted_at is null order by ev.updated_at desc, ev.id`,
        [companyId, status],
      );
      return { items: rows.map((row) => mapEvidence(row as ErpEvidenceRow)), source: ERP_EVIDENCE_SOURCE };
    }
    const rows = await sql.query(
      `${evidenceSelect} where ev.company_id = $1 and ev.deleted_at is null order by ev.updated_at desc, ev.id`,
      [companyId],
    );
    return { items: rows.map((row) => mapEvidence(row as ErpEvidenceRow)), source: ERP_EVIDENCE_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpEvidence(env: PostgresEnv | undefined, companyId: string, evidenceId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${evidenceSelect} where ev.company_id = $1 and ev.id = $2 and ev.deleted_at is null limit 1`,
      [companyId, evidenceId],
    );
    const row = rows[0] as ErpEvidenceRow | undefined;
    return { evidence: row ? mapEvidence(row) : null, source: ERP_EVIDENCE_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpEvidence(
  env: PostgresEnv | undefined,
  input: { id: string; companyId: string; actorUserId: string; createdAt: string; data: ErpEvidenceCreateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      insert into erp_evidence (
        id, company_id, expense_id, vendor_id, file_id, evidence_type, title, issued_at,
        supply_amount, tax_amount, total_amount, status, sync_status, memo,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) values (
        ${input.id}, ${input.companyId}, ${blankToNull(input.data.expenseId)}, ${blankToNull(input.data.vendorId)},
        ${input.data.fileId}, ${input.data.evidenceType}, ${input.data.title.trim()}, ${input.data.issuedAt ?? null}::date,
        ${input.data.supplyAmount ?? null}, ${input.data.taxAmount ?? null}, ${input.data.totalAmount ?? null},
        ${"draft"}, ${"not_connected"}, ${blankToNull(input.data.memo)}, ${input.actorUserId}, ${input.actorUserId},
        ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz
      ) returning id
    `;
    if (!rows[0]) return null;
    return findOperationalErpEvidence(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpEvidenceStatus(
  env: PostgresEnv | undefined,
  input: { companyId: string; evidenceId: string; actorUserId: string; status: ErpEvidenceStatus; reason: string; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      update erp_evidence
      set status = ${input.status}, rework_reason = ${input.status === "rework_requested" ? input.reason : null},
          updated_by_user_id = ${input.actorUserId}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.evidenceId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { evidence: null, source: ERP_EVIDENCE_SOURCE };
    return findOperationalErpEvidence(env, input.companyId, input.evidenceId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpEvidence(
  env: PostgresEnv | undefined,
  input: { companyId: string; evidenceId: string; actorUserId: string; updatedAt: string; data: ErpEvidenceUpdateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpEvidence(env, input.companyId, input.evidenceId);
    if (!existing?.evidence) return existing;
    const rows = await sql`
      update erp_evidence
      set expense_id = ${input.data.expenseId === undefined ? existing.evidence.expenseId : blankToNull(input.data.expenseId)},
          vendor_id = ${input.data.vendorId === undefined ? existing.evidence.vendorId : blankToNull(input.data.vendorId)},
          file_id = ${input.data.fileId ?? existing.evidence.fileId},
          evidence_type = ${input.data.evidenceType ?? existing.evidence.evidenceType},
          title = ${input.data.title?.trim() ?? existing.evidence.title},
          issued_at = ${(input.data.issuedAt ?? existing.evidence.issuedAt)}::date,
          supply_amount = ${input.data.supplyAmount === undefined ? existing.evidence.supplyAmount : input.data.supplyAmount},
          tax_amount = ${input.data.taxAmount === undefined ? existing.evidence.taxAmount : input.data.taxAmount},
          total_amount = ${input.data.totalAmount === undefined ? existing.evidence.totalAmount : input.data.totalAmount},
          memo = ${input.data.memo === undefined ? existing.evidence.memo : blankToNull(input.data.memo)},
          updated_by_user_id = ${input.actorUserId},
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.evidenceId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { evidence: null, source: ERP_EVIDENCE_SOURCE };
    return findOperationalErpEvidence(env, input.companyId, input.evidenceId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
