import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const requireFromDatabasePackage = createRequire(
  new URL("../packages/db/package.json", import.meta.url),
);
const postgres = requireFromDatabasePackage("postgres");

const API = "https://www.googleapis.com/calendar/v3";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";
const encoder = new TextEncoder();

function required(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`);
  return value;
}

export function parseAesKeyring(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("CALENDAR_KEYRING_INVALID");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("CALENDAR_KEYRING_INVALID");
  const keyring = new Map();
  for (const [versionText, encoded] of Object.entries(parsed)) {
    if (!/^[1-9][0-9]*$/u.test(versionText) || typeof encoded !== "string")
      throw new Error("CALENDAR_KEYRING_INVALID");
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Buffer.from(normalized + padding, "base64");
    if (bytes.byteLength !== 32) throw new Error("CALENDAR_KEYRING_INVALID");
    keyring.set(Number(versionText), bytes);
  }
  if (keyring.size < 1 || keyring.size > 16)
    throw new Error("CALENDAR_KEYRING_INVALID");
  return keyring;
}

export async function decryptCalendarValue(keyring, value, aad) {
  const raw = keyring.get(value.keyVersion);
  if (!raw) throw new Error("CALENDAR_KEY_VERSION_UNAVAILABLE");
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(raw),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  try {
    const clear = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Uint8Array.from(value.iv),
        additionalData: encoder.encode(aad),
      },
      key,
      Uint8Array.from(value.ciphertext),
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(clear);
  } catch {
    throw new Error("CALENDAR_MATERIAL_DECRYPT_FAILED");
  }
}

async function providerRequest(fetcher, url, init = {}, allowed = [200]) {
  let response;
  try {
    response = await fetcher(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.any([
        AbortSignal.timeout(30_000),
        ...(init.signal ? [init.signal] : []),
      ]),
    });
  } catch {
    throw new Error("GOOGLE_PROVIDER_OUTCOME_UNKNOWN");
  }
  if (response.status >= 300 && response.status < 400)
    throw new Error("GOOGLE_PROVIDER_REDIRECT_REJECTED");
  if (!allowed.includes(response.status)) {
    const error = new Error(`GOOGLE_PROVIDER_HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

function authorization(accessToken) {
  return { accept: "application/json", authorization: `Bearer ${accessToken}` };
}

async function strictJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("GOOGLE_PROVIDER_RESPONSE_INVALID");
  }
}

export async function refreshGoogleAccessToken(input) {
  const response = await providerRequest(
    input.fetcher,
    TOKEN,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: "refresh_token",
        refresh_token: input.refreshCredential,
      }),
    },
    [200],
  );
  const payload = await strictJson(response);
  if (
    !payload ||
    typeof payload.access_token !== "string" ||
    !payload.access_token ||
    payload.token_type !== "Bearer"
  )
    throw new Error("GOOGLE_PROVIDER_RESPONSE_INVALID");
  return payload.access_token;
}

async function calendarMetadata(fetcher, accessToken, calendarId) {
  let response;
  try {
    response = await providerRequest(
      fetcher,
      `${API}/calendars/${encodeURIComponent(calendarId)}?fields=id%2Cdescription`,
      { headers: authorization(accessToken) },
      [200, 404],
    );
  } catch (error) {
    throw error;
  }
  if (response.status === 404) return null;
  const value = await strictJson(response);
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.description !== "string"
  )
    throw new Error("GOOGLE_PROVIDER_RESPONSE_INVALID");
  return value;
}

async function findCalendar(fetcher, accessToken, description) {
  const matches = [];
  const seen = new Set();
  let pageToken;
  for (let page = 0; page < 40; page += 1) {
    const url = new URL(`${API}/users/me/calendarList`);
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("fields", "nextPageToken,items(id,description)");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const payload = await strictJson(
      await providerRequest(fetcher, url, {
        headers: authorization(accessToken),
      }),
    );
    if (
      !payload ||
      (payload.items !== undefined && !Array.isArray(payload.items))
    )
      throw new Error("GOOGLE_PROVIDER_RESPONSE_INVALID");
    for (const item of payload.items ?? []) {
      if (
        !item ||
        typeof item.id !== "string" ||
        (item.description !== undefined && typeof item.description !== "string")
      )
        throw new Error("GOOGLE_PROVIDER_RESPONSE_INVALID");
      if (item.description === description) matches.push(item.id);
    }
    if (matches.length > 1) throw new Error("GOOGLE_CALENDAR_AMBIGUOUS");
    if (payload.nextPageToken === undefined) break;
    if (
      typeof payload.nextPageToken !== "string" ||
      !payload.nextPageToken ||
      seen.has(payload.nextPageToken) ||
      page === 39
    )
      throw new Error("GOOGLE_PROVIDER_RESPONSE_INVALID");
    seen.add(payload.nextPageToken);
    pageToken = payload.nextPageToken;
  }
  return matches[0] ?? null;
}

export async function deleteMappedGoogleCalendar(input) {
  const expectedDescription = `werehere-link:v1:${input.lookupKey}`;
  let calendarId = input.calendarId;
  if (calendarId) {
    const direct = await calendarMetadata(
      input.fetcher,
      input.accessToken,
      calendarId,
    );
    if (
      direct &&
      (direct.id !== calendarId || direct.description !== expectedDescription)
    )
      throw new Error("GOOGLE_CALENDAR_MAPPING_MISMATCH");
    if (!direct) calendarId = null;
  }
  const discovered = await findCalendar(
    input.fetcher,
    input.accessToken,
    expectedDescription,
  );
  if (calendarId && discovered !== calendarId)
    throw new Error("GOOGLE_CALENDAR_MAPPING_MISMATCH");
  if (!calendarId) calendarId = discovered;
  if (!calendarId) return { outcome: "CONFIRMED_ABSENT" };

  const deleted = await providerRequest(
    input.fetcher,
    `${API}/calendars/${encodeURIComponent(calendarId)}`,
    {
      method: "DELETE",
      headers: authorization(input.accessToken),
    },
    [200, 204, 404],
  );
  if (deleted.status !== 404) {
    const readBack = await calendarMetadata(
      input.fetcher,
      input.accessToken,
      calendarId,
    );
    if (readBack !== null)
      throw new Error("GOOGLE_CALENDAR_DELETE_NOT_CONFIRMED");
  }
  return { outcome: "DELETED" };
}

export async function revokeGoogleCredential(input) {
  const response = await providerRequest(
    input.fetcher,
    REVOKE,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: input.refreshCredential }),
    },
    [200, 400],
  );
  return {
    outcome: response.status === 200 ? "REVOKED" : "CONFIRMED_INACTIVE",
  };
}

function encrypted(row, prefix) {
  return {
    ciphertext: row[`${prefix}_ciphertext`],
    iv: row[`${prefix}_iv`],
    keyVersion: row[`${prefix}_key_version`],
  };
}

async function audit(sql, input) {
  await sql`
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, reason,
      result, trace_id
    ) values (
      pg_catalog.gen_random_uuid(), ${input.eventCode}, null, 'SYSTEM', null,
      ${input.companyId}::uuid, null, ${input.resourceType},
      ${input.resourceId}::uuid, ${sql.json(input.summary)},
      '승인된 Preview Google Calendar provider 완전 폐기', ${input.result},
      ${input.traceId}::uuid
    )
  `;
}

function googleRemovalTransactionBody() {
  const source = readFileSync(
    new URL(
      "../packages/db/migrations/0045_remove_google_calendar_projection.sql",
      import.meta.url,
    ),
    "utf8",
  );
  if (!source.startsWith("begin;\n") || !/\ncommit;\s*$/u.test(source))
    throw new Error("GOOGLE_REMOVAL_MIGRATION_TRANSACTION_INVALID");
  return source.replace(/^begin;\n/u, "").replace(/\ncommit;\s*$/u, "\n");
}

const providerTableLockSql = `
  lock table
    public.calendar_connections,
    public.calendar_connection_credentials,
    public.calendar_oauth_transactions,
    public.calendar_hotel_links,
    public.calendar_event_links,
    public.calendar_projection_jobs,
    public.calendar_projection_attempts,
    public.calendar_sync_failures,
    public.calendar_catch_up_items,
    public.calendar_crypto_settings
  in access exclusive mode
`;

export async function runPreviewGoogleDecommission(input) {
  const sql = postgres(input.databaseUrl, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 2,
    prepare: false,
  });
  const traceId = crypto.randomUUID();
  const fetcher = input.fetcher ?? fetch;
  let deletedCalendarCount = 0;
  let revokedCredentialCount = 0;
  try {
    const [state] = await sql`
      select
        exists(select 1 from public.schema_migrations where version='0044_google_calendar_projection') as provider_present,
        exists(select 1 from public.schema_migrations where version='0045_remove_google_calendar_projection') as provider_removed,
        pg_catalog.to_regclass('public.calendar_connections') is not null as provider_tables_present,
        (
          select count(*)::integer
            from pg_catalog.unnest(array[
              'calendar_connections',
              'calendar_connection_credentials',
              'calendar_oauth_transactions',
              'calendar_hotel_links',
              'calendar_event_links',
              'calendar_projection_jobs',
              'calendar_projection_attempts',
              'calendar_sync_failures',
              'calendar_catch_up_items',
              'calendar_crypto_settings'
            ]::text[]) relation_name
           where pg_catalog.to_regclass('public.' || relation_name) is not null
        ) as provider_relation_count
    `;
    if (state?.provider_removed) {
      if (state.provider_relation_count !== 0)
        throw new Error("GOOGLE_PROVIDER_REMOVAL_INCOMPLETE");
      return { deletedCalendarCount: 0, revokedCredentialCount: 0 };
    }
    if (!state?.provider_tables_present) {
      if (state?.provider_present)
        throw new Error("GOOGLE_PROVIDER_SCHEMA_MARKER_INCONSISTENT");
      return { deletedCalendarCount: 0, revokedCredentialCount: 0 };
    }
    if (!state.provider_present)
      throw new Error("GOOGLE_PROVIDER_SCHEMA_MARKER_INCONSISTENT");

    const clientId =
      input.clientId || required("GOOGLE_CALENDAR_OAUTH_CLIENT_ID");
    const clientSecret =
      input.clientSecret || required("GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET");
    const keyring =
      input.keyring ||
      parseAesKeyring(required("CALENDAR_CREDENTIAL_AES_KEYRING_JSON"));

    const result = await sql.begin(async (tx) => {
      await tx.unsafe(`
        do $provider_company_fence$
        declare
          locked_company_id uuid;
        begin
          for locked_company_id in
            select company_record.id
              from public.companies company_record
             order by company_record.id
          loop
            perform pg_catalog.pg_advisory_xact_lock(
              pg_catalog.hashtextextended(locked_company_id::text, 0)
            );
          end loop;
        end
        $provider_company_fence$;
      `);
      await tx.unsafe(providerTableLockSql);

      const [inFlight] = await tx`
        select
          (select count(*)::integer
             from public.calendar_projection_jobs
            where status = 'PROCESSING') as processing_job_count,
          (select count(*)::integer
             from public.calendar_oauth_transactions
            where status = 'CLAIMED') as claimed_oauth_count
      `;
      if (inFlight?.processing_job_count !== 0)
        throw new Error("GOOGLE_PROVIDER_INVOCATION_NOT_DRAINED");
      if (inFlight?.claimed_oauth_count !== 0)
        throw new Error("GOOGLE_PROVIDER_OAUTH_OUTCOME_UNRESOLVED");

      const credentials = await tx`
      select id::text, company_id::text, connection_id::text,
             credential_version, lifecycle,
             refresh_credential_ciphertext as credential_ciphertext,
             refresh_credential_iv as credential_iv,
             encryption_key_version as credential_key_version,
             exists (
               select 1
                 from public.audit_events disposition_audit
                where disposition_audit.company_id = calendar_connection_credentials.company_id
                  and disposition_audit.resource_type = 'CALENDAR_CONNECTION_CREDENTIAL'
                  and disposition_audit.resource_id = calendar_connection_credentials.id
                  and disposition_audit.event_code = 'GOOGLE_CALENDAR_DECOMMISSION_REVOKE_CONFIRMED'
                  and disposition_audit.occurred_at >= calendar_connection_credentials.updated_at
             ) as disposition_confirmed
        from public.calendar_connection_credentials
       order by company_id, connection_id, credential_version
    `;
      const connections = await tx`
      select id::text, company_id::text, active_credential_id::text
        from public.calendar_connections
       order by company_id, id
    `;
      const links = await tx`
      select id::text, company_id::text, branch_id::text, connection_id::text,
             generation, lookup_key_ciphertext as lookup_ciphertext,
             lookup_key_iv as lookup_iv,
             lookup_key_version,
             calendar_id_ciphertext as calendar_ciphertext,
             calendar_id_iv as calendar_iv,
             calendar_id_key_version,
             exists (
               select 1
                 from public.audit_events disposition_audit
                where disposition_audit.company_id = calendar_hotel_links.company_id
                  and disposition_audit.resource_type = 'CALENDAR_HOTEL_LINK'
                  and disposition_audit.resource_id = calendar_hotel_links.id
                  and disposition_audit.event_code = 'GOOGLE_CALENDAR_DECOMMISSION_DELETE_CONFIRMED'
                  and disposition_audit.occurred_at >= calendar_hotel_links.updated_at
             ) as disposition_confirmed
        from public.calendar_hotel_links
       order by company_id, connection_id, branch_id, generation
    `;
      const providerCompanies = await tx`
      select distinct provider_company.company_id::text as company_id
        from (
          select company_id from public.calendar_connections
          union all select company_id from public.calendar_connection_credentials
          union all select company_id from public.calendar_oauth_transactions
          union all select company_id from public.calendar_hotel_links
          union all select company_id from public.calendar_event_links
          union all select company_id from public.calendar_projection_jobs
        ) provider_company
       order by company_id
    `;
      const credentialById = new Map(credentials.map((row) => [row.id, row]));

      for (const connection of connections) {
        const connectionLinks = links.filter(
          (link) =>
            link.connection_id === connection.id && !link.disposition_confirmed,
        );
        if (connectionLinks.length === 0) continue;
        const credential = credentialById.get(connection.active_credential_id);
        if (!credential)
          throw new Error("GOOGLE_ACTIVE_CREDENTIAL_UNAVAILABLE");
        const refreshCredential = await decryptCalendarValue(
          keyring,
          encrypted(credential, "credential"),
          `credential|${credential.company_id}|${credential.connection_id}|${credential.credential_version}`,
        );
        const accessToken = await refreshGoogleAccessToken({
          fetcher,
          clientId,
          clientSecret,
          refreshCredential,
        });
        for (const link of connectionLinks) {
          const lookupKey = await decryptCalendarValue(
            keyring,
            encrypted(link, "lookup"),
            `calendar_lookup_key|${link.company_id}|${link.branch_id}|${link.id}|${link.generation}`,
          );
          const calendarId = link.calendar_ciphertext
            ? await decryptCalendarValue(
                keyring,
                encrypted(link, "calendar"),
                `calendar_id|${link.company_id}|${link.branch_id}|${link.id}|${link.generation}`,
              )
            : null;
          await audit(sql, {
            eventCode: "GOOGLE_CALENDAR_DECOMMISSION_DELETE_ATTEMPTED",
            companyId: link.company_id,
            resourceType: "CALENDAR_HOTEL_LINK",
            resourceId: link.id,
            result: "SUCCEEDED",
            summary: { outcome: "ATTEMPTED" },
            traceId,
          });
          try {
            const result = await deleteMappedGoogleCalendar({
              fetcher,
              accessToken,
              calendarId,
              lookupKey,
            });
            if (result.outcome === "DELETED") deletedCalendarCount += 1;
            await audit(sql, {
              eventCode: "GOOGLE_CALENDAR_DECOMMISSION_DELETE_CONFIRMED",
              companyId: link.company_id,
              resourceType: "CALENDAR_HOTEL_LINK",
              resourceId: link.id,
              result: "SUCCEEDED",
              summary: { outcome: result.outcome },
              traceId,
            });
          } catch (error) {
            await audit(sql, {
              eventCode: "GOOGLE_CALENDAR_DECOMMISSION_DELETE_UNRESOLVED",
              companyId: link.company_id,
              resourceType: "CALENDAR_HOTEL_LINK",
              resourceId: link.id,
              result: "FAILED",
              summary: {
                outcome: "OUTCOME_UNKNOWN",
                safeErrorCode:
                  error instanceof Error ? error.message : "UNKNOWN_ERROR",
              },
              traceId,
            });
            throw error;
          }
        }
      }

      for (const credential of credentials) {
        if (credential.disposition_confirmed) continue;
        const refreshCredential = await decryptCalendarValue(
          keyring,
          encrypted(credential, "credential"),
          `credential|${credential.company_id}|${credential.connection_id}|${credential.credential_version}`,
        );
        await audit(sql, {
          eventCode: "GOOGLE_CALENDAR_DECOMMISSION_REVOKE_ATTEMPTED",
          companyId: credential.company_id,
          resourceType: "CALENDAR_CONNECTION_CREDENTIAL",
          resourceId: credential.id,
          result: "SUCCEEDED",
          summary: { outcome: "ATTEMPTED" },
          traceId,
        });
        try {
          const result = await revokeGoogleCredential({
            fetcher,
            refreshCredential,
          });
          revokedCredentialCount += 1;
          await audit(sql, {
            eventCode: "GOOGLE_CALENDAR_DECOMMISSION_REVOKE_CONFIRMED",
            companyId: credential.company_id,
            resourceType: "CALENDAR_CONNECTION_CREDENTIAL",
            resourceId: credential.id,
            result: "SUCCEEDED",
            summary: { outcome: result.outcome },
            traceId,
          });
        } catch (error) {
          await audit(sql, {
            eventCode: "GOOGLE_CALENDAR_DECOMMISSION_REVOKE_UNRESOLVED",
            companyId: credential.company_id,
            resourceType: "CALENDAR_CONNECTION_CREDENTIAL",
            resourceId: credential.id,
            result: "FAILED",
            summary: {
              outcome: "OUTCOME_UNKNOWN",
              safeErrorCode:
                error instanceof Error ? error.message : "UNKNOWN_ERROR",
            },
            traceId,
          });
          throw error;
        }
      }

      const [unresolved] = await tx`
        select
          (select count(*)::integer
             from public.calendar_hotel_links current_link
            where not exists (
              select 1
                from public.audit_events disposition_audit
               where disposition_audit.company_id = current_link.company_id
                 and disposition_audit.resource_type = 'CALENDAR_HOTEL_LINK'
                 and disposition_audit.resource_id = current_link.id
                 and disposition_audit.event_code = 'GOOGLE_CALENDAR_DECOMMISSION_DELETE_CONFIRMED'
                 and disposition_audit.occurred_at >= current_link.updated_at
            )) as unresolved_link_count,
          (select count(*)::integer
             from public.calendar_connection_credentials current_credential
            where not exists (
              select 1
                from public.audit_events disposition_audit
               where disposition_audit.company_id = current_credential.company_id
                 and disposition_audit.resource_type = 'CALENDAR_CONNECTION_CREDENTIAL'
                 and disposition_audit.resource_id = current_credential.id
                 and disposition_audit.event_code = 'GOOGLE_CALENDAR_DECOMMISSION_REVOKE_CONFIRMED'
                 and disposition_audit.occurred_at >= current_credential.updated_at
            )) as unresolved_credential_count
      `;
      if (
        unresolved?.unresolved_link_count !== 0 ||
        unresolved?.unresolved_credential_count !== 0
      )
        throw new Error("GOOGLE_PROVIDER_DISPOSITION_REVALIDATION_FAILED");

      await tx`delete from public.calendar_catch_up_items`;
      await tx`delete from public.calendar_sync_failures`;
      await tx`delete from public.calendar_projection_attempts`;
      await tx`delete from public.calendar_projection_jobs`;
      await tx`delete from public.calendar_event_links`;
      await tx`delete from public.calendar_hotel_links`;
      await tx`delete from public.calendar_oauth_transactions`;
      await tx`update public.calendar_connections set active_credential_id = null`;
      await tx`delete from public.calendar_connection_credentials`;
      await tx`delete from public.calendar_connections`;
      await tx`delete from public.calendar_crypto_settings`;

      for (const company of providerCompanies) {
        await audit(tx, {
          eventCode: "GOOGLE_CALENDAR_DECOMMISSION_DB_DISPOSITION_CONFIRMED",
          companyId: company.company_id,
          resourceType: "COMPANY",
          resourceId: company.company_id,
          result: "SUCCEEDED",
          summary: {
            calendarCount: links.filter(
              (row) => row.company_id === company.company_id,
            ).length,
            credentialCount: credentials.filter(
              (row) => row.company_id === company.company_id,
            ).length,
            outcome: "PROVIDER_ROWS_REMOVED",
          },
          traceId,
        });
      }

      await tx.unsafe(googleRemovalTransactionBody());
      return { deletedCalendarCount, revokedCredentialCount };
    });

    const [removedState] = await sql`
      select
        exists(select 1 from public.schema_migrations where version='0045_remove_google_calendar_projection') as marker_present,
        pg_catalog.to_regclass('public.calendar_connections') is null as connections_absent,
        pg_catalog.to_regclass('public.calendar_connection_credentials') is null as credentials_absent,
        pg_catalog.to_regclass('public.calendar_hotel_links') is null as links_absent,
        pg_catalog.to_regclass('public.calendar_projection_jobs') is null as jobs_absent
    `;
    if (
      !removedState?.marker_present ||
      !removedState.connections_absent ||
      !removedState.credentials_absent ||
      !removedState.links_absent ||
      !removedState.jobs_absent
    )
      throw new Error("GOOGLE_PROVIDER_REMOVAL_INCOMPLETE");
    return result;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const keyringJson = process.env.CALENDAR_CREDENTIAL_AES_KEYRING_JSON;
  const result = await runPreviewGoogleDecommission({
    databaseUrl: required("DATABASE_URL_PREVIEW"),
    clientId: process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET,
    keyring: keyringJson ? parseAesKeyring(keyringJson) : undefined,
  });
  process.stdout.write(
    `PREVIEW_GOOGLE_PROVIDER_DISPOSITION_OK calendars=${result.deletedCalendarCount} credentials=${result.revokedCredentialCount}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const code =
      error instanceof Error && /^[A-Z0-9_]{2,100}$/u.test(error.message)
        ? error.message
        : "GOOGLE_PROVIDER_DECOMMISSION_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
