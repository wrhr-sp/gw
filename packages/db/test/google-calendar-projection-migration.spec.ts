import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0044_google_calendar_projection.sql",
  import.meta.url,
);
const repositoryUrl = new URL(
  "../src/calendar-projections.ts",
  import.meta.url,
);
const readinessUrl = new URL("../src/client.ts", import.meta.url);
const provisionUrl = new URL(
  "../scripts/provision-preview.ts",
  import.meta.url,
);

describe("Google Calendar projection migration", () => {
  it("keeps manual retry attempts monotonic and hides visit UUIDs from provider IDs", () => {
    const migration = readFileSync(migrationUrl, "utf8");
    expect(migration).not.toContain("status='PENDING',attempt_count=0");
    expect(migration).not.toContain("'ca'||replace(new.id::text,'-','')");
    expect(migration).not.toContain(
      "'ca'||replace(item.visit_id::text,'-','')",
    );
    expect(migration).toContain(
      "substring(encode(pg_catalog.sha256(pg_catalog.convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex') from 1 for 40)",
    );
  });

  it("stores encrypted-only credentials and tenant-scoped projection aggregates", () => {
    const migration = readFileSync(migrationUrl, "utf8");
    for (const value of [
      "0044_google_calendar_projection",
      "CALENDAR_CONNECTION_MANAGE",
      "CALENDAR_PROJECTION_RETRY",
      "calendar_oauth_transactions",
      "nonce_hash",
      "expected_connection_id",
      "expected_connection_version",
      "openid",
      "calendar_connections",
      "calendar_connection_credentials",
      "calendar_hotel_links",
      "calendar_event_links",
      "calendar_projection_jobs",
      "calendar_projection_attempts",
      "calendar_sync_failures",
      "calendar_catch_up_items",
      "force row level security",
      "skip locked",
      "claim_token_hash",
      "desired_source_version",
      "applied_source_version",
      "calendar_projection_visit_signal_v1",
      "originating_session_id",
      "calendar_oauth_fail_v1",
      "calendar_candidate_claim_v1",
      "calendar_candidate_finalize_v1",
      "scheduled_reconciler_invocation_enter_v1",
      "scheduled_reconciler_invocation_exit_v1",
      "scheduled_reconciler_drain_barrier_v1",
      "calendar_connection_manage_hotel_allowed_v1",
      "calendar_visit_projection_status_v1",
      "calendar_repair_projection_status_v1",
      "create or replace function public.repair_snapshot_v1",
      "create or replace function public.hotel_calendar_events_read_v1",
      "public.calendar_visit_projection_status_v1(visit.company_id, visit.branch_id, visit.id)",
      "OAUTH_RATE_LIMITED",
      "expires_at>created_at and expires_at<=created_at+interval '10 minutes'",
    ])
      expect(migration).toContain(value);
    expect(migration).not.toMatch(/\brefresh_token\b/u);
    expect(migration).not.toMatch(/\baccess_token\b/u);
    expect(migration).not.toContain("provider_calendar_id text");
    expect(migration).not.toContain("provider_event_id");
  });

  it("normalizes public states and fences disconnect, candidate promotion, and late finalization", () => {
    const migration = readFileSync(migrationUrl, "utf8");
    for (const invariant of [
      "when l.status='PENDING_CREATE' then 'PENDING'",
      "p_action='PROMOTE_CANDIDATE'",
      "p_action='CONFIRM_ACCOUNT_CHANGE'",
      "status in ('PENDING','PROCESSING','FAILED')",
      "attempted_hotel_link_generation",
      "attempted_hotel_link_version",
      "attempted_credential_id",
      "create_dispatch_state",
      "attempted_starts_at",
      "attempted_ends_at",
      "attempted_visit_status",
      "pg_advisory_lock_shared",
      "pg_advisory_unlock_shared",
      "pg_advisory_xact_lock",
      "p_company_id::text||':oauth:'||actor.user_id::text",
      "claim_expires_at>statement_timestamp()",
      "p_result='PREFLIGHT'",
      "public.hotel_calendar_permission_allowed_v1(candidate.company_id,null,candidate.created_by,'CALENDAR_CONNECTION_MANAGE')",
      "'activeCredentialFingerprint'",
      "p_candidate_id uuid",
      "p_expected_candidate_row_version integer",
      "p_replacement_links jsonb",
      "id=p_candidate_id",
      "candidate.row_version<>p_expected_candidate_row_version",
      "tx.expected_connection_version",
      "calendar_connection_manage_hotel_allowed_v1(transaction_row.company_id,affected_link.branch_id,transaction_row.actor_user_id)",
      "public.calendar_connection_manage_hotel_allowed_v1(p_company_id,h.branch_id,actor.user_id)",
      "p_expected_generation integer",
      "connection_row.status not in ('CONNECTED','DISCONNECTED')",
      "attempt_count<8",
      "verification_attempt_count>=8",
      "calendar_projection_failure_retry_v1",
      "matched_count<>1",
      "p_transaction_id is null or id=p_transaction_id",
      "calendar_projection_finalize_v1(p_company_id,p_job_id,p_claim_token_hash,'PREFLIGHT','NO_OP'",
      "calendar_authorization_lock_v1",
      "lock table public.permission_grants,public.user_role_memberships,public.roles,public.user_group_memberships,public.user_groups in share mode",
      "perform 1 from public.auth_sessions session_record",
      "perform 1 from public.hotel_staff_assignments assignment",
      "perform public.calendar_authorization_lock_v1(transaction_row.company_id,transaction_row.actor_user_id,transaction_row.session_id)",
      "delete from public.calendar_oauth_transactions where id=transaction_row.id",
      "perform public.calendar_authorization_lock_v1(tx.company_id,tx.actor_user_id,tx.session_id)",
      "perform public.calendar_authorization_lock_v1(candidate.company_id,candidate.created_by,candidate.originating_session_id)",
      "status='SUPERSEDED',replay_requested=false",
      "p_excluded_job_id",
      "job.attempted_event_link_version+1=event_record.version",
      "perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0))",
      "for share of affected_link,branch_record,hotel_record",
      "CALENDAR_PROJECTION_FAILURE_RETRY_REQUESTED",
      "create table public.calendar_crypto_settings",
      "current_hmac_key_version integer not null",
      "revoke all on table public.calendar_crypto_settings from public",
      "crypto_settings.current_hmac_key_version",
      "public.hotel_calendar_permission_allowed_v1(p_company_id,p_branch_id,actor.user_id,'CALENDAR_PROJECTION_RETRY')",
      "public.hotel_staff_assignments assignment",
      "for share",
      "or not public.calendar_connection_manage_hotel_allowed_v1(p_company_id,p_branch_id,actor.user_id)",
      "char_length(btrim(p_reason)) not between 2 and 500",
      "'CALENDAR_HOTEL_LINK_CREATE'",
      "'CALENDAR_HOTEL_LINK_DISCONNECT'",
      "id=p_failure_id and status='OPEN' for update",
      "failure.version<>p_expected_version",
      "get diagnostics inserted_count=row_count",
      "status='RETRY_REQUESTED',version=version+1 where id=failure.id",
    ])
      expect(migration).toContain(invariant);
    expect(migration).toMatch(
      /p_action='CONFIRM_ACCOUNT_CHANGE'[\s\S]*insert into public\.calendar_hotel_links[\s\S]*'PENDING_CREATE'/u,
    );
    expect(migration).toMatch(
      /calendar_oauth_finalize_v1[\s\S]*delete from public\.calendar_oauth_transactions where id=tx\.id/u,
    );
    expect(migration).toContain("status in ('CLAIMED','FAILED')");
    expect(migration).toContain(
      "join public.branches hotel_branch on hotel_branch.company_id=h.company_id and hotel_branch.id=h.branch_id",
    );
    expect(migration).toContain("'hotelName',hotel_branch.name");
    const foundationHarness = readFileSync(
      new URL("./run-foundation-integration.sh", import.meta.url),
      "utf8",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_ASSIGNMENT_MUTATION_LOCK_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_AUTHORIZATION_REVOKE_FIRST_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_SECOND_PREFLIGHT_ACTUAL_DB_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_OAUTH_SUCCESS_PATH_LOCK_MATRIX_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_EXACT_EVIDENCE_VERSION_FENCE_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_OAUTH_LOCK_ORDER_DEADLOCK_REGRESSION_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_CANDIDATE_AUTHORIZATION_RACE_MATRIX_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_OAUTH_CLAIM_PERMISSION_REVOKE_FIRST_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_OAUTH_FINALIZE_ASSIGNMENT_REVOKE_FIRST_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_CANDIDATE_CLAIM_REVOKE_FIRST_BARRIERS_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_CANDIDATE_FINALIZE_REVOKE_FIRST_BARRIERS_OK",
    );
    expect(foundationHarness).toContain("set statement_timeout='500ms'");
    const oauthClaim = migration.slice(
      migration.indexOf("create function public.calendar_oauth_claim_v1"),
      migration.indexOf("create function public.calendar_oauth_fail_v1"),
    );
    expect(oauthClaim.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(-1);
    expect(oauthClaim.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      oauthClaim.indexOf("for update"),
    );
    const oauthFinalize = migration.slice(
      migration.indexOf("create function public.calendar_oauth_finalize_v1"),
      migration.indexOf("create function public.calendar_candidate_claim_v1"),
    );
    expect(oauthFinalize.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(-1);
    expect(oauthFinalize.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      oauthFinalize.indexOf("for update"),
    );
    const authorizationLock = migration.slice(
      migration.indexOf(
        "create function public.calendar_authorization_lock_v1",
      ),
      migration.indexOf("create function public.calendar_oauth_start_v1"),
    );
    expect(authorizationLock.indexOf("for affected_branch_id in")).toBeLessThan(
      authorizationLock.indexOf("lock table public.permission_grants"),
    );
    expect(
      authorizationLock.indexOf("for share of affected_link"),
    ).toBeLessThan(
      authorizationLock.indexOf("lock table public.permission_grants"),
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_BRANCH_PERMISSION_LOCK_ORDER_OK",
    );
    expect(migration).toContain("left join lateral");
    expect(migration).toContain(
      "order by candidate_job.created_at desc,candidate_job.id desc",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_OAUTH_TERMINAL_ERASURE_OK",
    );
  });

  it("preserves every immutable uncertain-create fence across promotion and recovery", () => {
    const migration = readFileSync(migrationUrl, "utf8");
    const repository = readFileSync(repositoryUrl, "utf8");
    const foundationHarness = readFileSync(
      new URL("./run-foundation-integration.sh", import.meta.url),
      "utf8",
    );
    expect(migration).toContain(
      "uncertain_job.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' and uncertain_job.status not in ('SUCCEEDED','SUPERSEDED')",
    );
    expect(migration).toContain(
      "uncertain_hotel.connection_id=c.id and uncertain_job.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN'",
    );
    expect(migration).toContain(
      "uncertain_job.status='DEAD_LETTER' and exists(select 1 from public.calendar_sync_failures resolved_failure where resolved_failure.company_id=uncertain_job.company_id and resolved_failure.job_id=uncertain_job.id and resolved_failure.status='RESOLVED')",
    );
    expect(migration).toContain(
      "not exists(select 1 from public.calendar_sync_failures unresolved_failure where unresolved_failure.company_id=uncertain_job.company_id and unresolved_failure.job_id=uncertain_job.id and unresolved_failure.status<>'RESOLVED')",
    );
    expect(migration).toContain(
      "create function public.calendar_projection_reset_event_existence_v1",
    );
    expect(migration).toContain(
      "case when terminal_job.aggregate_type='HOTEL_CALENDAR' then retried_hotel.version else terminal_job.attempted_hotel_link_version end",
    );
    expect(migration).toContain(
      "case when terminal_job.aggregate_type='VISIT_EVENT' then retried_event.version else terminal_job.attempted_event_link_version end",
    );
    expect(migration).toContain(
      "hashtextextended(p_company_id::text||':calendar-provider:'||p_connection_id::text,0)",
    );
    expect(migration).toContain(
      "perform public.calendar_authorization_lock_v1(p_company_id,actor.user_id,actor.session_id)",
    );
    expect(repository).not.toContain("calendar_idempotency_begin_v1");
    expect(repository).not.toContain("calendar_idempotency_store_v1");
    expect(repository).not.toContain("calendar_mutation_authorize_v1");
    expect(repository).not.toContain("insert into public.idempotency_records");
    expect(repository).not.toContain("delete from public.idempotency_records");
    expect(migration).not.toContain(
      "create function public.calendar_idempotency_store_v1",
    );
    for (const command of [
      "calendar_oauth_start_v1",
      "calendar_connection_command_v1",
      "calendar_hotel_link_command_v1",
      "calendar_projection_failure_retry_v1",
    ]) {
      const body = migration.slice(
        migration.indexOf(`create function public.${command}`),
        migration.indexOf("$function$;", migration.indexOf(`create function public.${command}`)),
      );
      expect(body).toContain("repair_idempotency_begin_v1");
      expect(body).toContain("repair_idempotency_store_v1");
    }
    expect(migration).toContain(
      "terminal_job.attempted_starts_at,terminal_job.attempted_ends_at,terminal_job.attempted_visit_status",
    );
    for (const immutableFence of [
      "terminal_job.attempted_hotel_link_generation",
      "terminal_job.attempted_credential_id",
      "terminal_job.attempted_credential_version",
    ])
      expect(migration).toContain(immutableFence);
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_UNCERTAIN_CREATE_PROMOTION_BLOCKED_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_UNCERTAIN_RETRY_FENCES_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_IDEMPOTENCY_STORE_DIRECT_EXECUTE_DENIED_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_IDEMPOTENCY_HELPER_READINESS_DAMAGE_OK",
    );
    expect(foundationHarness).toContain(
      "GOOGLE_CALENDAR_UPDATE_404_RECONCILER_ACTUAL_JOURNEY_OK",
    );
  });

  it("registers exact API and reconciler routines for readiness and Preview provisioning", () => {
    const source = [
      readFileSync(repositoryUrl, "utf8"),
      readFileSync(readinessUrl, "utf8"),
      readFileSync(provisionUrl, "utf8"),
    ].join("\n");
    for (const routine of [
      "calendar_connection_status_read_v1",
      "calendar_oauth_start_v1",
      "calendar_oauth_claim_v1",
      "calendar_oauth_finalize_v1",
      "calendar_connection_command_v1",
      "calendar_hotel_link_command_v1",
      "calendar_projection_failure_retry_v1",
      "scheduled_reconciler_invocation_enter_v1",
      "scheduled_reconciler_invocation_exit_v1",
      "scheduled_reconciler_drain_barrier_v1",
      "calendar_projection_claim_v1",
      "calendar_projection_mark_create_dispatched_v1",
      "calendar_projection_repair_stale_v1",
      "calendar_projection_finalize_v1",
      "calendar_projection_evidence_read_v1",
      "calendar_authorization_lock_v1",
      "repair_idempotency_begin_v1",
      "repair_idempotency_store_v1",
    ])
      expect(source).toContain(routine);
    const readiness = readFileSync(readinessUrl, "utf8");
    const provision = readFileSync(provisionUrl, "utf8");
    expect(provision).not.toMatch(
      /grant execute on function public\.repair_idempotency_(?:begin|store)_v1/iu,
    );
    expect(readiness).toContain("google_calendar_projection_marker_count");
    expect(readiness).toContain("calendarProjectionPhase");
    for (const table of [
      "calendar_connections",
      "calendar_connection_credentials",
      "calendar_oauth_transactions",
      "calendar_hotel_links",
      "calendar_event_links",
      "calendar_projection_jobs",
      "calendar_projection_attempts",
      "calendar_sync_failures",
      "calendar_catch_up_items",
    ])
      expect(readiness).toContain(table);
    expect(readiness).toContain(
      "calendar_oauth_start_v1(uuid,text,uuid,bytea,bytea,bytea,bytea,bytea,integer,text,boolean,integer,integer,uuid,text,text,text)",
    );
    expect(readiness).toContain(
      "calendar_projection_mark_create_dispatched_v1(uuid,uuid,bytea)",
    );
    expect(readiness).toContain("relforcerowsecurity");
    expect(readiness).toContain("prosecdef");
    expect(readiness).toContain("proconfig");
    expect(provision).toContain(
      "calendar_projection_mark_create_dispatched_v1(",
    );
    expect(provision).toContain("calendar_projection_repair_stale_v1(");
  });
});
