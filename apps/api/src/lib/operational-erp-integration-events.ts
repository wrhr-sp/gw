import type {
  ErpIntegrationEvent,
  ErpIntegrationEventCreateRequest,
  ErpIntegrationEventResourceType,
  ErpIntegrationEventStatus,
  ErpIntegrationEventUpdateRequest,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ERP_INTEGRATION_EVENT_SOURCE = "postgres" as const;

type ErpIntegrationEventRow = {
  id: string;
  company_id: string;
  provider: "external_erp" | "kyungrinara";
  direction: ErpIntegrationEvent["direction"];
  resource_type: ErpIntegrationEventResourceType;
  resource_id: string | null;
  title: string;
  status: ErpIntegrationEventStatus;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | Date | null;
  external_reference_id: string | null;
  external_status: string | null;
  failure_code: string | null;
  failure_message: string | null;
  safe_payload_summary: string | null;
  safe_response_summary: string | null;
  requested_by_user_id: string;
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

function mapIntegrationEvent(row: ErpIntegrationEventRow): ErpIntegrationEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    provider: row.provider,
    direction: row.direction,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    title: row.title,
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    nextRetryAt: toIsoString(row.next_retry_at),
    externalReferenceId: row.external_reference_id,
    externalStatus: row.external_status,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    safePayloadSummary: row.safe_payload_summary,
    safeResponseSummary: row.safe_response_summary,
    requestedByUserId: row.requested_by_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const eventSelect = `
  select id, company_id, provider, direction, resource_type, resource_id, title, status,
    attempt_count, max_attempts, next_retry_at, external_reference_id, external_status,
    failure_code, failure_message, safe_payload_summary, safe_response_summary,
    requested_by_user_id, created_at, updated_at
  from erp_integration_events
`;

export async function listOperationalErpIntegrationEvents(env: PostgresEnv | undefined, companyId: string, status?: ErpIntegrationEventStatus) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (status) {
      const rows = await sql.query(`${eventSelect} where company_id = $1 and status = $2 and deleted_at is null order by updated_at desc, id`, [companyId, status]);
      return { items: rows.map((row) => mapIntegrationEvent(row as ErpIntegrationEventRow)), source: ERP_INTEGRATION_EVENT_SOURCE };
    }
    const rows = await sql.query(`${eventSelect} where company_id = $1 and deleted_at is null order by updated_at desc, id`, [companyId]);
    return { items: rows.map((row) => mapIntegrationEvent(row as ErpIntegrationEventRow)), source: ERP_INTEGRATION_EVENT_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpIntegrationEvent(env: PostgresEnv | undefined, companyId: string, eventId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(`${eventSelect} where company_id = $1 and id = $2 and deleted_at is null limit 1`, [companyId, eventId]);
    const row = rows[0] as ErpIntegrationEventRow | undefined;
    return { event: row ? mapIntegrationEvent(row) : null, source: ERP_INTEGRATION_EVENT_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpIntegrationEvent(
  env: PostgresEnv | undefined,
  input: { id: string; companyId: string; actorUserId: string; createdAt: string; data: ErpIntegrationEventCreateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      insert into erp_integration_events (
        id, company_id, provider, direction, resource_type, resource_id, title, status,
        max_attempts, next_retry_at, external_reference_id, external_status, failure_code,
        failure_message, safe_payload_summary, safe_response_summary, requested_by_user_id,
        created_at, updated_at
      ) values (
        ${input.id}, ${input.companyId}, ${"external_erp"}, ${input.data.direction}, ${input.data.resourceType},
        ${blankToNull(input.data.resourceId)}, ${input.data.title.trim()}, ${input.data.status}, ${input.data.maxAttempts},
        ${input.data.nextRetryAt ?? null}::timestamptz, ${blankToNull(input.data.externalReferenceId)},
        ${blankToNull(input.data.externalStatus)}, ${blankToNull(input.data.failureCode)}, ${blankToNull(input.data.failureMessage)},
        ${blankToNull(input.data.safePayloadSummary)}, ${blankToNull(input.data.safeResponseSummary)}, ${input.actorUserId},
        ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz
      ) returning id
    `;
    if (!rows[0]) return null;
    return findOperationalErpIntegrationEvent(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpIntegrationEventStatus(
  env: PostgresEnv | undefined,
  input: { companyId: string; eventId: string; status: ErpIntegrationEventStatus; updatedAt: string; failureCode?: string; failureMessage?: string; externalReferenceId?: string; externalStatus?: string; nextRetryAt?: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpIntegrationEvent(env, input.companyId, input.eventId);
    if (!existing?.event) return existing;
    const rows = await sql`
      update erp_integration_events
      set status = ${input.status},
          attempt_count = case when ${input.status} in ('sending', 'failed', 'retry_required') then attempt_count + 1 else attempt_count end,
          failure_code = ${input.failureCode === undefined ? existing.event.failureCode : blankToNull(input.failureCode)},
          failure_message = ${input.failureMessage === undefined ? existing.event.failureMessage : blankToNull(input.failureMessage)},
          external_reference_id = ${input.externalReferenceId === undefined ? existing.event.externalReferenceId : blankToNull(input.externalReferenceId)},
          external_status = ${input.externalStatus === undefined ? existing.event.externalStatus : blankToNull(input.externalStatus)},
          next_retry_at = ${(input.nextRetryAt ?? existing.event.nextRetryAt)}::timestamptz,
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.eventId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { event: null, source: ERP_INTEGRATION_EVENT_SOURCE };
    return findOperationalErpIntegrationEvent(env, input.companyId, input.eventId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpIntegrationEvent(
  env: PostgresEnv | undefined,
  input: { companyId: string; eventId: string; updatedAt: string; data: ErpIntegrationEventUpdateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpIntegrationEvent(env, input.companyId, input.eventId);
    if (!existing?.event) return existing;
    const rows = await sql`
      update erp_integration_events
      set direction = ${input.data.direction ?? existing.event.direction},
          resource_type = ${input.data.resourceType ?? existing.event.resourceType},
          resource_id = ${input.data.resourceId === undefined ? existing.event.resourceId : blankToNull(input.data.resourceId)},
          title = ${input.data.title?.trim() ?? existing.event.title},
          status = ${input.data.status ?? existing.event.status},
          max_attempts = ${input.data.maxAttempts ?? existing.event.maxAttempts},
          next_retry_at = ${(input.data.nextRetryAt ?? existing.event.nextRetryAt)}::timestamptz,
          external_reference_id = ${input.data.externalReferenceId === undefined ? existing.event.externalReferenceId : blankToNull(input.data.externalReferenceId)},
          external_status = ${input.data.externalStatus === undefined ? existing.event.externalStatus : blankToNull(input.data.externalStatus)},
          failure_code = ${input.data.failureCode === undefined ? existing.event.failureCode : blankToNull(input.data.failureCode)},
          failure_message = ${input.data.failureMessage === undefined ? existing.event.failureMessage : blankToNull(input.data.failureMessage)},
          safe_payload_summary = ${input.data.safePayloadSummary === undefined ? existing.event.safePayloadSummary : blankToNull(input.data.safePayloadSummary)},
          safe_response_summary = ${input.data.safeResponseSummary === undefined ? existing.event.safeResponseSummary : blankToNull(input.data.safeResponseSummary)},
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.eventId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { event: null, source: ERP_INTEGRATION_EVENT_SOURCE };
    return findOperationalErpIntegrationEvent(env, input.companyId, input.eventId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
