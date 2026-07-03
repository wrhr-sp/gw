import type {
  ElectronicContract,
  ElectronicContractCreateRequest,
  ElectronicContractParty,
  ElectronicContractPartyRole,
  ElectronicContractPartyStatus,
  ElectronicContractStatus,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ELECTRONIC_CONTRACT_SOURCE = "postgres-r2" as const;

type ElectronicContractRow = {
  id: string;
  company_id: string;
  title: string;
  summary: string | null;
  contract_type: string;
  status: ElectronicContractStatus;
  owner_user_id: string;
  owner_employee_id: string;
  file_id: string | null;
  file_name: string | null;
  effective_from: string | Date | null;
  expires_at: string | Date | null;
  external_provider: string | null;
  external_contract_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ElectronicContractPartyRow = {
  id: string;
  company_id: string;
  contract_id: string;
  employee_id: string | null;
  name: string;
  email: string | null;
  role: ElectronicContractPartyRole;
  signing_order: number | string;
  status: ElectronicContractPartyStatus;
  signed_at: string | Date | null;
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

function mapContract(row: ElectronicContractRow): ElectronicContract {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    summary: row.summary,
    contractType: row.contract_type,
    status: row.status,
    ownerUserId: row.owner_user_id,
    ownerEmployeeId: row.owner_employee_id,
    fileId: row.file_id,
    fileName: row.file_name,
    effectiveFrom: toIsoString(row.effective_from),
    expiresAt: toIsoString(row.expires_at),
    externalProvider: row.external_provider,
    externalContractId: row.external_contract_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

function mapParty(row: ElectronicContractPartyRow): ElectronicContractParty {
  return {
    id: row.id,
    companyId: row.company_id,
    contractId: row.contract_id,
    employeeId: row.employee_id,
    name: row.name,
    email: row.email,
    role: row.role,
    signingOrder: Number(row.signing_order),
    status: row.status,
    signedAt: toIsoString(row.signed_at),
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

async function listParties(sql: NonNullable<ReturnType<typeof createOperationalSql>>, companyId: string, contractId: string) {
  const rows = await sql`
    select id, company_id, contract_id, employee_id, name, email, role, signing_order, status, signed_at, created_at, updated_at
    from electronic_contract_parties
    where company_id = ${companyId}
      and contract_id = ${contractId}
      and deleted_at is null
    order by signing_order, id
  `;
  return rows.map((row) => mapParty(row as ElectronicContractPartyRow));
}

const contractSelect = `
  select
    c.id,
    c.company_id,
    c.title,
    c.summary,
    c.contract_type,
    c.status,
    c.owner_user_id,
    c.owner_employee_id,
    c.file_id,
    f.file_name,
    c.effective_from,
    c.expires_at,
    c.external_provider,
    c.external_contract_id,
    c.created_at,
    c.updated_at
  from electronic_contracts c
  left join file_objects f on f.id = c.file_id and f.company_id = c.company_id and f.deleted_at is null
`;

export async function listOperationalElectronicContracts(env: PostgresEnv | undefined, companyId: string, status?: ElectronicContractStatus) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (status) {
      const rows = await sql.query(
        `${contractSelect}
         where c.company_id = $1 and c.status = $2 and c.deleted_at is null
         order by c.created_at desc, c.id`,
        [companyId, status],
      );
      return { items: rows.map((row) => mapContract(row as ElectronicContractRow)), source: ELECTRONIC_CONTRACT_SOURCE };
    }
    const rows = await sql.query(
      `${contractSelect}
       where c.company_id = $1 and c.deleted_at is null
       order by c.created_at desc, c.id`,
      [companyId],
    );
    return { items: rows.map((row) => mapContract(row as ElectronicContractRow)), source: ELECTRONIC_CONTRACT_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalElectronicContract(env: PostgresEnv | undefined, companyId: string, contractId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${contractSelect}
       where c.company_id = $1 and c.id = $2 and c.deleted_at is null
       limit 1`,
      [companyId, contractId],
    );
    const row = rows[0] as ElectronicContractRow | undefined;
    if (!row) return { contract: null, parties: [], source: ELECTRONIC_CONTRACT_SOURCE };
    return {
      contract: mapContract(row),
      parties: await listParties(sql, companyId, contractId),
      source: ELECTRONIC_CONTRACT_SOURCE,
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalElectronicContract(
  env: PostgresEnv | undefined,
  input: {
    id: string;
    companyId: string;
    ownerUserId: string;
    ownerEmployeeId: string;
    createdAt: string;
    data: ElectronicContractCreateRequest;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const contractRows = await sql`
      insert into electronic_contracts (
        id, company_id, title, summary, contract_type, status, owner_user_id, owner_employee_id, file_id,
        effective_from, expires_at, created_at, updated_at
      )
      values (
        ${input.id},
        ${input.companyId},
        ${input.data.title},
        ${input.data.summary ?? null},
        ${input.data.contractType},
        ${"draft"},
        ${input.ownerUserId},
        ${input.ownerEmployeeId},
        ${input.data.fileId ?? null},
        ${input.data.effectiveFrom ?? null}::timestamptz,
        ${input.data.expiresAt ?? null}::timestamptz,
        ${input.createdAt}::timestamptz,
        ${input.createdAt}::timestamptz
      )
      returning id
    `;
    if (!contractRows[0]) return null;

    for (const [index, party] of input.data.parties.entries()) {
      await sql`
        insert into electronic_contract_parties (
          id, company_id, contract_id, employee_id, name, email, role, signing_order, status, created_at, updated_at
        )
        values (
          ${`${input.id}_party_${index + 1}`},
          ${input.companyId},
          ${input.id},
          ${party.employeeId ?? null},
          ${party.name},
          ${party.email ?? null},
          ${party.role},
          ${party.signingOrder},
          ${"pending"},
          ${input.createdAt}::timestamptz,
          ${input.createdAt}::timestamptz
        )
      `;
    }

    return findOperationalElectronicContract(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalElectronicContractStatus(
  env: PostgresEnv | undefined,
  input: { companyId: string; contractId: string; status: ElectronicContractStatus; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    await sql`
      update electronic_contracts
      set status = ${input.status}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId}
        and id = ${input.contractId}
        and deleted_at is null
    `;

    if (input.status === "signature_requested") {
      await sql`
        update electronic_contract_parties
        set status = case when status = 'pending' then 'requested' else status end,
            updated_at = ${input.updatedAt}::timestamptz
        where company_id = ${input.companyId}
          and contract_id = ${input.contractId}
          and deleted_at is null
      `;
    }

    if (input.status === "signed") {
      await sql`
        update electronic_contract_parties
        set status = case when status in ('pending', 'requested') then 'signed' else status end,
            signed_at = coalesce(signed_at, ${input.updatedAt}::timestamptz),
            updated_at = ${input.updatedAt}::timestamptz
        where company_id = ${input.companyId}
          and contract_id = ${input.contractId}
          and role = 'signer'
          and deleted_at is null
      `;
    }

    return findOperationalElectronicContract(env, input.companyId, input.contractId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
