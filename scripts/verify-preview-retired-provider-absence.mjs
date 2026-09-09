import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const postgres = createRequire(new URL("../packages/db/package.json", import.meta.url))("postgres");

const workers = [
  "werehere-hotel-api-preview",
  "werehere-hotel-account-reconciler-preview",
];
const retiredKeys = new Set([
  "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET",
  "CALENDAR_CREDENTIAL_AES_KEYRING_JSON",
  "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
  "FILE_PROCESSOR_SHARED_SECRET",
]);

export function assertProviderAbsent(state) {
  if (state?.provider_removed !== true || state?.provider_relation_count !== 0)
    throw new Error("PREVIEW_RETIRED_PROVIDER_REMAINS");
}

export function assertSecretsAbsent(body) {
  if (!body || body.success !== true || !Array.isArray(body.result) ||
      !Array.isArray(body.errors) || body.errors.length !== 0 ||
      (body.result_info != null && (
        body.result_info.total_count !== body.result.length ||
        body.result_info.total_pages !== 1 || body.result_info.page !== 1
      ))) throw new Error("PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
  const names = new Set();
  for (const item of body.result) {
    if (!item || typeof item.name !== "string" || !item.name.trim() ||
        item.type !== "secret_text" || names.has(item.name))
      throw new Error("PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
    names.add(item.name);
    if (retiredKeys.has(item.name)) throw new Error("PREVIEW_RETIRED_PROVIDER_REMAINS");
  }
}

async function readBoundedJson(response) {
  if (response.status !== 200 || !response.body)
    throw new Error("PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error("PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function verifyRetiredProviderAbsence(input) {
  if (!input.databaseUrl || !/^[a-f0-9]{32}$/.test(input.accountId ?? "") || !input.apiToken)
    throw new Error("PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
  const sql = (input.connect ?? postgres)(input.databaseUrl, {
    connect_timeout: 10, idle_timeout: 10, max: 1, prepare: false,
    connection: { statement_timeout: 10000, default_transaction_read_only: "on" },
  });
  try {
    const state = await sql.begin("read only", async (tx) => {
      const rows = await tx`
        select exists(select 1 from public.schema_migrations
          where version='0045_remove_google_calendar_projection') as provider_removed,
          (select count(*)::integer from pg_catalog.unnest(array[
            'calendar_connections', 'calendar_connection_credentials',
            'calendar_oauth_transactions', 'calendar_hotel_links',
            'calendar_event_links', 'calendar_projection_jobs',
            'calendar_projection_attempts', 'calendar_sync_failures',
            'calendar_catch_up_items', 'calendar_crypto_settings'
          ]::text[]) relation_name
          where pg_catalog.to_regclass('public.' || relation_name) is not null
          ) as provider_relation_count
      `;
      if (rows.length !== 1) throw new Error("PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
      return rows[0];
    });
    assertProviderAbsent(state);
  } finally {
    await sql.end({ timeout: 5 });
  }
  for (const worker of workers) {
    const response = await (input.fetcher ?? fetch)(
      `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/workers/scripts/${worker}/secrets`,
      { method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${input.apiToken}` } },
    );
    assertSecretsAbsent(await readBoundedJson(response));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyRetiredProviderAbsence({
      databaseUrl: process.env.DATABASE_URL_PREVIEW,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    });
    console.log("PREVIEW_RETIRED_PROVIDER_ABSENCE_OK");
  } catch (error) {
    console.error(error?.message === "PREVIEW_RETIRED_PROVIDER_REMAINS"
      ? "PREVIEW_RETIRED_PROVIDER_REMAINS"
      : "PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
    process.exitCode = 1;
  }
}
