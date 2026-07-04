import type {
  ErpAccountingMapping,
  ErpAccountingMappingCreateRequest,
  ErpAccountingMappingRecordStatus,
  ErpAccountingMappingStatus,
  ErpAccountingMappingType,
  ErpAccountingMappingUpdateRequest,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ERP_ACCOUNTING_MAPPING_SOURCE = "postgres" as const;

type ErpAccountingMappingRow = {
  id: string;
  company_id: string;
  mapping_type: ErpAccountingMappingType;
  internal_code: string;
  internal_name: string;
  external_provider: "kyungrinara" | null;
  external_code: string | null;
  external_name: string | null;
  mapping_status: ErpAccountingMappingStatus;
  status: ErpAccountingMappingRecordStatus;
  memo: string | null;
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

function blankToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function mapAccountingMapping(row: ErpAccountingMappingRow): ErpAccountingMapping {
  return {
    id: row.id,
    companyId: row.company_id,
    mappingType: row.mapping_type,
    internalCode: row.internal_code,
    internalName: row.internal_name,
    externalProvider: row.external_provider,
    externalCode: row.external_code,
    externalName: row.external_name,
    mappingStatus: row.mapping_status,
    status: row.status,
    memo: row.memo,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const mappingSelect = `
  select id, company_id, mapping_type, internal_code, internal_name, external_provider,
    external_code, external_name, mapping_status, status, memo, created_by_user_id,
    updated_by_user_id, created_at, updated_at
  from erp_accounting_mappings
`;

export async function listOperationalErpAccountingMappings(env: PostgresEnv | undefined, companyId: string, mappingType?: ErpAccountingMappingType) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (mappingType) {
      const rows = await sql.query(
        `${mappingSelect} where company_id = $1 and mapping_type = $2 and deleted_at is null order by updated_at desc, id`,
        [companyId, mappingType],
      );
      return { items: rows.map((row) => mapAccountingMapping(row as ErpAccountingMappingRow)), source: ERP_ACCOUNTING_MAPPING_SOURCE };
    }
    const rows = await sql.query(
      `${mappingSelect} where company_id = $1 and deleted_at is null order by updated_at desc, id`,
      [companyId],
    );
    return { items: rows.map((row) => mapAccountingMapping(row as ErpAccountingMappingRow)), source: ERP_ACCOUNTING_MAPPING_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpAccountingMapping(env: PostgresEnv | undefined, companyId: string, mappingId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${mappingSelect} where company_id = $1 and id = $2 and deleted_at is null limit 1`,
      [companyId, mappingId],
    );
    const row = rows[0] as ErpAccountingMappingRow | undefined;
    return { mapping: row ? mapAccountingMapping(row) : null, source: ERP_ACCOUNTING_MAPPING_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpAccountingMapping(
  env: PostgresEnv | undefined,
  input: { id: string; companyId: string; actorUserId: string; createdAt: string; data: ErpAccountingMappingCreateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      insert into erp_accounting_mappings (
        id, company_id, mapping_type, internal_code, internal_name, external_provider,
        external_code, external_name, mapping_status, status, memo, created_by_user_id,
        updated_by_user_id, created_at, updated_at
      ) values (
        ${input.id}, ${input.companyId}, ${input.data.mappingType}, ${input.data.internalCode.trim()},
        ${input.data.internalName.trim()}, ${blankToNull(input.data.externalCode) ? "kyungrinara" : null},
        ${blankToNull(input.data.externalCode)}, ${blankToNull(input.data.externalName)}, ${input.data.mappingStatus},
        ${"active"}, ${blankToNull(input.data.memo)}, ${input.actorUserId}, ${input.actorUserId},
        ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz
      ) returning id
    `;
    if (!rows[0]) return null;
    return findOperationalErpAccountingMapping(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpAccountingMappingStatus(
  env: PostgresEnv | undefined,
  input: {
    companyId: string;
    mappingId: string;
    actorUserId: string;
    status: ErpAccountingMappingRecordStatus;
    mappingStatus?: ErpAccountingMappingStatus;
    updatedAt: string;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpAccountingMapping(env, input.companyId, input.mappingId);
    if (!existing?.mapping) return existing;
    const rows = await sql`
      update erp_accounting_mappings
      set status = ${input.status}, mapping_status = ${input.mappingStatus ?? existing.mapping.mappingStatus},
          updated_by_user_id = ${input.actorUserId}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.mappingId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { mapping: null, source: ERP_ACCOUNTING_MAPPING_SOURCE };
    return findOperationalErpAccountingMapping(env, input.companyId, input.mappingId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpAccountingMapping(
  env: PostgresEnv | undefined,
  input: { companyId: string; mappingId: string; actorUserId: string; updatedAt: string; data: ErpAccountingMappingUpdateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpAccountingMapping(env, input.companyId, input.mappingId);
    if (!existing?.mapping) return existing;
    const nextExternalCode = input.data.externalCode === undefined ? existing.mapping.externalCode : blankToNull(input.data.externalCode);
    const rows = await sql`
      update erp_accounting_mappings
      set mapping_type = ${input.data.mappingType ?? existing.mapping.mappingType},
          internal_code = ${input.data.internalCode?.trim() ?? existing.mapping.internalCode},
          internal_name = ${input.data.internalName?.trim() ?? existing.mapping.internalName},
          external_provider = ${nextExternalCode ? "kyungrinara" : null},
          external_code = ${nextExternalCode},
          external_name = ${input.data.externalName === undefined ? existing.mapping.externalName : blankToNull(input.data.externalName)},
          mapping_status = ${input.data.mappingStatus ?? existing.mapping.mappingStatus},
          memo = ${input.data.memo === undefined ? existing.mapping.memo : blankToNull(input.data.memo)},
          updated_by_user_id = ${input.actorUserId}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.mappingId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { mapping: null, source: ERP_ACCOUNTING_MAPPING_SOURCE };
    return findOperationalErpAccountingMapping(env, input.companyId, input.mappingId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
