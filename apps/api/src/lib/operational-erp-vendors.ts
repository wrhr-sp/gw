import type { ErpVendor, ErpVendorCreateRequest, ErpVendorStatus, ErpVendorUpdateRequest } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ERP_VENDOR_SOURCE = "postgres" as const;

type ErpVendorRow = {
  id: string;
  company_id: string;
  business_registration_number: string;
  name: string;
  representative_name: string | null;
  address: string | null;
  business_type: string | null;
  business_item: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  tax_invoice_email: string | null;
  settlement_term: string | null;
  memo: string | null;
  status: ErpVendorStatus;
  external_provider: "external_erp" | "kyungrinara" | null;
  external_reference_id: string | null;
  sync_status: ErpVendor["syncStatus"];
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

function blankToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function mapVendor(row: ErpVendorRow): ErpVendor {
  return {
    id: row.id,
    companyId: row.company_id,
    businessRegistrationNumber: row.business_registration_number,
    name: row.name,
    representativeName: row.representative_name,
    address: row.address,
    businessType: row.business_type,
    businessItem: row.business_item,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    taxInvoiceEmail: row.tax_invoice_email,
    settlementTerm: row.settlement_term,
    memo: row.memo,
    status: row.status,
    externalProvider: row.external_provider,
    externalReferenceId: row.external_reference_id,
    syncStatus: row.sync_status,
    lastSyncedAt: toIsoString(row.last_synced_at),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const vendorSelect = `
  select id, company_id, business_registration_number, name, representative_name, address,
    business_type, business_item, contact_name, contact_phone, contact_email, tax_invoice_email,
    settlement_term, memo, status, external_provider, external_reference_id, sync_status,
    last_synced_at, created_by_user_id, updated_by_user_id, created_at, updated_at
  from erp_vendors
`;

export async function listOperationalErpVendors(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${vendorSelect} where company_id = $1 and deleted_at is null order by updated_at desc, id`,
      [companyId],
    );
    return { items: rows.map((row) => mapVendor(row as ErpVendorRow)), source: ERP_VENDOR_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpVendor(env: PostgresEnv | undefined, companyId: string, vendorId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${vendorSelect} where company_id = $1 and id = $2 and deleted_at is null limit 1`,
      [companyId, vendorId],
    );
    const row = rows[0] as ErpVendorRow | undefined;
    return { vendor: row ? mapVendor(row) : null, source: ERP_VENDOR_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpVendor(
  env: PostgresEnv | undefined,
  input: { id: string; companyId: string; actorUserId: string; createdAt: string; data: ErpVendorCreateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      insert into erp_vendors (
        id, company_id, business_registration_number, name, representative_name, address,
        business_type, business_item, contact_name, contact_phone, contact_email, tax_invoice_email,
        settlement_term, memo, status, sync_status, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) values (
        ${input.id}, ${input.companyId}, ${input.data.businessRegistrationNumber.trim()}, ${input.data.name.trim()},
        ${blankToNull(input.data.representativeName)}, ${blankToNull(input.data.address)}, ${blankToNull(input.data.businessType)},
        ${blankToNull(input.data.businessItem)}, ${blankToNull(input.data.contactName)}, ${blankToNull(input.data.contactPhone)},
        ${blankToNull(input.data.contactEmail)}, ${blankToNull(input.data.taxInvoiceEmail)}, ${blankToNull(input.data.settlementTerm)},
        ${blankToNull(input.data.memo)}, ${"active"}, ${"not_connected"}, ${input.actorUserId}, ${input.actorUserId},
        ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz
      ) returning id
    `;
    if (!rows[0]) return null;
    return findOperationalErpVendor(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpVendor(
  env: PostgresEnv | undefined,
  input: { companyId: string; vendorId: string; actorUserId: string; updatedAt: string; data: ErpVendorUpdateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpVendor(env, input.companyId, input.vendorId);
    if (!existing?.vendor) return existing;
    const rows = await sql`
      update erp_vendors
      set business_registration_number = ${input.data.businessRegistrationNumber?.trim() ?? existing.vendor.businessRegistrationNumber},
          name = ${input.data.name?.trim() ?? existing.vendor.name},
          representative_name = ${input.data.representativeName === undefined ? existing.vendor.representativeName : blankToNull(input.data.representativeName)},
          address = ${input.data.address === undefined ? existing.vendor.address : blankToNull(input.data.address)},
          business_type = ${input.data.businessType === undefined ? existing.vendor.businessType : blankToNull(input.data.businessType)},
          business_item = ${input.data.businessItem === undefined ? existing.vendor.businessItem : blankToNull(input.data.businessItem)},
          contact_name = ${input.data.contactName === undefined ? existing.vendor.contactName : blankToNull(input.data.contactName)},
          contact_phone = ${input.data.contactPhone === undefined ? existing.vendor.contactPhone : blankToNull(input.data.contactPhone)},
          contact_email = ${input.data.contactEmail === undefined ? existing.vendor.contactEmail : blankToNull(input.data.contactEmail)},
          tax_invoice_email = ${input.data.taxInvoiceEmail === undefined ? existing.vendor.taxInvoiceEmail : blankToNull(input.data.taxInvoiceEmail)},
          settlement_term = ${input.data.settlementTerm === undefined ? existing.vendor.settlementTerm : blankToNull(input.data.settlementTerm)},
          memo = ${input.data.memo === undefined ? existing.vendor.memo : blankToNull(input.data.memo)},
          updated_by_user_id = ${input.actorUserId},
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.vendorId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { vendor: null, source: ERP_VENDOR_SOURCE };
    return findOperationalErpVendor(env, input.companyId, input.vendorId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpVendorStatus(
  env: PostgresEnv | undefined,
  input: { companyId: string; vendorId: string; actorUserId: string; status: ErpVendorStatus; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      update erp_vendors
      set status = ${input.status}, updated_by_user_id = ${input.actorUserId}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.vendorId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { vendor: null, source: ERP_VENDOR_SOURCE };
    return findOperationalErpVendor(env, input.companyId, input.vendorId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
