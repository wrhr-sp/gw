#!/usr/bin/env bash
set -euo pipefail

# Keep SQL current_date aligned with the hotel-local materializer clock,
# including CI runs that cross Korean midnight while the database defaults to UTC.
export PGTZ="Asia/Seoul"

PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

configure_test_database_timezone() {
  local admin_url="$1"
  local alter_database_sql
  alter_database_sql="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
    -c "select pg_catalog.format('alter database %I set timezone to ''Asia/Seoul''', pg_catalog.current_database())")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "$alter_database_sql" >/dev/null
}

configure_runtime_probe_role() {
  local admin_url="$1"
  local probe_password
  probe_password="$(openssl rand -hex 24)"
  psql -X -v ON_ERROR_STOP=1 -v probe_password="$probe_password" -d "$admin_url" >/dev/null <<'SQL'
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gw_runtime_probe') THEN
    CREATE ROLE gw_runtime_probe LOGIN;
  END IF;
END
$role$;
ALTER ROLE gw_runtime_probe NOSUPERUSER NOBYPASSRLS NOINHERIT PASSWORD :'probe_password';
GRANT USAGE ON SCHEMA public TO gw_runtime_probe;
GRANT EXECUTE ON FUNCTION reconciliation_company_ids(), runtime_is_schema_owner(),
  runtime_has_capability(text), api_current_company_id(), reconciler_current_company_id(),
  jsonb_reject_plaintext_password_keys(jsonb)
  TO gw_runtime_probe;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM gw_runtime_probe;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM gw_runtime_probe;
GRANT SELECT ON account_provisioning_attempts, auth_identities, branches, companies,
  hotel_file_finalizer_capabilities,
  hotel_owner_assignments, hotel_profiles, hotel_staff_assignments,
  housekeeping_hotel_links, outbox_jobs, permissions,
  runtime_database_capabilities, schema_migrations, users
  TO gw_runtime_probe;
GRANT INSERT ON audit_events, auth_identities, hotel_owner_assignments,
  hotel_staff_assignments, housekeeping_hotel_links, outbox_jobs, users
  TO gw_runtime_probe;
GRANT UPDATE ON account_provisioning_attempts, outbox_jobs TO gw_runtime_probe;
GRANT EXECUTE ON FUNCTION hotel_file_scan_command_v1(uuid,text,text,bigint,jsonb,uuid),
  hotel_file_scan_candidates_v1(integer),
  hotel_file_access_recover_expired_v1(integer),
  hotel_inspection_claim_materialization_v1(uuid,bytea,integer),
  hotel_inspection_complete_materialization_v1(uuid,bigint,bytea,uuid)
  TO gw_runtime_probe;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('gw_runtime_probe', 'RECONCILER')
ON CONFLICT (role_name) DO UPDATE SET capability = excluded.capability;
INSERT INTO hotel_file_finalizer_capabilities (role_name)
VALUES ('gw_runtime_probe')
ON CONFLICT (role_name) DO NOTHING;
SQL
  node -e "const u=new URL(process.argv[1]);u.username='gw_runtime_probe';u.password=process.argv[2];console.log(u.toString())" "$admin_url" "$probe_password"
}

configure_api_probe_role() {
  local admin_url="$1"
  local probe_password
  probe_password="$(openssl rand -hex 24)"
  psql -X -v ON_ERROR_STOP=1 -v probe_password="$probe_password" -d "$admin_url" >/dev/null <<'SQL'
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gw_api_probe') THEN
    CREATE ROLE gw_api_probe LOGIN;
  END IF;
END
$role$;
ALTER ROLE gw_api_probe NOSUPERUSER NOBYPASSRLS NOINHERIT PASSWORD :'probe_password';
GRANT USAGE ON SCHEMA public TO gw_api_probe;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM gw_api_probe;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM gw_api_probe;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.idempotency_records TO gw_api_probe;
GRANT SELECT ON TABLE public.runtime_database_capabilities TO gw_api_probe;
GRANT EXECUTE ON FUNCTION
  public.runtime_is_schema_owner(),
  public.runtime_has_capability(text),
  public.api_current_company_id(),
  public.reconciler_current_company_id()
  TO gw_api_probe;
GRANT EXECUTE ON FUNCTION
  hotel_process_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_process_default_read_v1(uuid,uuid,text),
  hotel_process_reviewer_candidates_v1(uuid,uuid,text),
  hotel_inspection_routines_read_v1(uuid,uuid,uuid,text),
  hotel_inspection_routine_command_v1(uuid,uuid,uuid,integer,jsonb,text,text,text,text,text,uuid,uuid,uuid),
  hotel_inspection_executions_read_v1(uuid,uuid,uuid,jsonb,text),
  hotel_inspection_command_v2(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_inspection_checklist_v2_command(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_inspection_checklist_v3_command(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_file_upload_scope_v1(uuid,uuid,text),
  hotel_inspection_reviews_read_v1(uuid,uuid,uuid,jsonb,text),
  hotel_inspection_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid),
  hotel_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid)
  TO gw_api_probe;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('gw_api_probe', 'API_RUNTIME')
ON CONFLICT (role_name) DO UPDATE SET capability = excluded.capability;
SQL
  node -e "const u=new URL(process.argv[1]);u.username='gw_api_probe';u.password=process.argv[2];console.log(u.toString())" "$admin_url" "$probe_password"
}

cleanup_api_probe_role() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
DELETE FROM runtime_database_capabilities WHERE role_name = 'gw_api_probe';
DROP OWNED BY gw_api_probe;
DROP ROLE IF EXISTS gw_api_probe;
SQL
}

grant_checklist_v2_api_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $grant_checklist_v2$
declare
  capability_role record;
begin
  for capability_role in
    select role_name from public.runtime_database_capabilities
     where capability = 'API_RUNTIME'
  loop
    execute format(
      'grant execute on function public.hotel_inspection_checklist_v2_command(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I',
      capability_role.role_name
    );
    if pg_catalog.to_regprocedure(
      'public.hotel_inspection_checklist_v3_command(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)'
    ) is not null then
      execute format(
        'grant execute on function public.hotel_inspection_checklist_v3_command(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I',
        capability_role.role_name
      );
    end if;
  end loop;
end
$grant_checklist_v2$;
SQL
}

grant_facility_execution_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $grant_facility_execution$
declare capability_role record;
begin
  for capability_role in select role_name, capability from public.runtime_database_capabilities where capability in ('API_RUNTIME','RECONCILER')
  loop
    if capability_role.capability = 'API_RUNTIME' then
      execute format('grant execute on function public.hotel_inspection_routines_read_v2(uuid,uuid,uuid,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_inspection_routine_command_v2(uuid,uuid,uuid,integer,jsonb,text,text,text,text,text,uuid,uuid,uuid) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_inspection_execution_read_v2(uuid,uuid,uuid,jsonb,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_inspection_command_v3(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    else
      execute format('grant execute on function public.hotel_inspection_claim_next_materialization_v2(bytea,integer) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_inspection_complete_materialization_v2(uuid,bigint,bytea,uuid) to %I', capability_role.role_name);
    end if;
  end loop;
end
$grant_facility_execution$;
SQL
}

grant_repair_lifecycle_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $grant_repair_lifecycle$
declare capability_role record;
begin
  for capability_role in select role_name from public.runtime_database_capabilities where capability='API_RUNTIME'
  loop
    execute format('grant execute on function public.hotel_inspection_execution_read_v2(uuid,uuid,uuid,jsonb,text) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_process_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_repair_read_v1(uuid,uuid,uuid,jsonb,text) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_repair_priority_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_repair_case_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_repair_visit_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_repair_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_repair_file_upload_init_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    execute format('grant execute on function public.hotel_repair_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid) to %I', capability_role.role_name);
    if to_regprocedure('public.hotel_calendar_capabilities_v1(uuid,text)') is not null then
      execute format('grant execute on function public.hotel_calendar_capabilities_v1(uuid,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_calendar_events_read_v1(uuid,uuid,jsonb,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_calendar_visit_options_read_v1(uuid,uuid,text) to %I', capability_role.role_name);
    end if;
    if to_regprocedure('public.calendar_oauth_finalize_v1(uuid,bytea,uuid,uuid,integer,bytea,bytea,integer,bytea,integer,text[])') is not null then
      execute format('grant execute on function public.calendar_connection_status_read_v1(uuid,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.calendar_oauth_start_v1(uuid,text,uuid,bytea,bytea,bytea,bytea,bytea,integer,text,boolean,integer,integer,uuid,text,text,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.calendar_oauth_claim_v1(bytea,bytea,bytea) to %I', capability_role.role_name);
      execute format('grant execute on function public.calendar_oauth_fail_v1(uuid,bytea,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.calendar_oauth_finalize_v1(uuid,bytea,uuid,uuid,integer,bytea,bytea,integer,bytea,integer,text[]) to %I', capability_role.role_name);
      execute format('grant execute on function public.calendar_connection_command_v1(uuid,uuid,text,text,integer,uuid,integer,jsonb,text,uuid,text,text,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.calendar_hotel_link_command_v1(uuid,uuid,uuid,text,text,integer,integer,integer,uuid,bytea,bytea,integer,bytea,text,uuid,text,text,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.calendar_projection_failure_retry_v1(uuid,uuid,text,uuid,integer,text,uuid,text,text,text) to %I', capability_role.role_name);
    end if;
  end loop;
end
$grant_repair_lifecycle$;
SQL
}

grant_google_calendar_reconciler_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $grant_google_calendar_reconciler$
declare capability_role record;
begin
  if to_regprocedure('public.calendar_projection_claim_v1(uuid,bytea,integer)') is null then
    return;
  end if;
  for capability_role in select role_name from public.runtime_database_capabilities where capability='RECONCILER'
  loop
    execute format('grant execute on function public.calendar_candidate_claim_v1(uuid,bytea) to %I', capability_role.role_name);
    execute format('grant execute on function public.calendar_candidate_finalize_v1(uuid,uuid,bytea,integer,integer,text,text,timestamptz) to %I', capability_role.role_name);
    execute format('grant execute on function public.scheduled_reconciler_invocation_enter_v1() to %I', capability_role.role_name);
    execute format('grant execute on function public.scheduled_reconciler_invocation_exit_v1() to %I', capability_role.role_name);
    execute format('grant execute on function public.scheduled_reconciler_drain_barrier_v1() to %I', capability_role.role_name);
    execute format('grant execute on function public.calendar_projection_claim_v1(uuid,bytea,integer) to %I', capability_role.role_name);
    execute format('grant execute on function public.calendar_projection_mark_create_dispatched_v1(uuid,uuid,bytea) to %I', capability_role.role_name);
    execute format('grant execute on function public.calendar_projection_reset_event_existence_v1(uuid,uuid,bytea) to %I', capability_role.role_name);
    execute format('grant execute on function public.calendar_projection_repair_stale_v1(uuid,uuid) to %I', capability_role.role_name);
    execute format('grant execute on function public.calendar_projection_finalize_v1(uuid,uuid,bytea,text,text,text,timestamptz,bytea,bytea,integer,integer) to %I', capability_role.role_name);
    execute format('grant execute on function public.calendar_projection_evidence_read_v1(uuid,text,bytea,uuid,integer,uuid,timestamptz) to %I', capability_role.role_name);
  end loop;
end
$grant_google_calendar_reconciler$;
SQL
}

run_actual_inspection_api_probe() {
  local admin_url="$1"
  local api_probe_url probe_status
  api_probe_url="$(configure_api_probe_role "$admin_url")"
  set +e
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$api_probe_url" INSPECTION_SQL="$HOTEL_INSPECTION_PROCESS_TEST_SQL" \
      pnpm exec tsx apps/api/test/inspection-process-actual-api-integration.ts
  )
  probe_status=$?
  set -e
  cleanup_api_probe_role "$admin_url"
  return "$probe_status"
}

run_actual_facility_inspection_api_probe() {
  local admin_url="$1"
  local api_probe_url probe_status
  api_probe_url="$(configure_api_probe_role "$admin_url")"
  grant_facility_execution_capabilities "$admin_url"
  set +e
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$api_probe_url" \
      INSPECTION_FACILITY_SQL="$HOTEL_INSPECTION_FACILITY_EXECUTION_TEST_SQL" \
      pnpm exec tsx apps/api/test/inspection-facility-execution-actual-api-integration.ts
  )
  probe_status=$?
  set -e
  cleanup_api_probe_role "$admin_url"
  return "$probe_status"
}

run_actual_repair_api_probe() {
  local admin_url="$1"
  local api_probe_url probe_status fixture_result
  fixture_result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -f "$HOTEL_REPAIR_LIFECYCLE_TEST_SQL")"
  if [[ "$fixture_result" != *"HOTEL_REPAIR_LIFECYCLE_FIXTURE_OK"* ]]; then
    printf '%s\n' "$fixture_result" >&2
    return 1
  fi
  api_probe_url="$(configure_api_probe_role "$admin_url")"
  grant_repair_lifecycle_capabilities "$admin_url"
  set +e
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$api_probe_url" \
      INSPECTION_FACILITY_SQL="$HOTEL_INSPECTION_FACILITY_EXECUTION_TEST_SQL" \
      pnpm exec tsx apps/api/test/repair-lifecycle-actual-api-integration.ts
  )
  probe_status=$?
  set -e
  cleanup_api_probe_role "$admin_url"
  return "$probe_status"
}

run_actual_calendar_api_probe() {
  local admin_url="$1"
  local api_probe_url probe_status fixture_result
  fixture_result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -f "$HOTEL_CALENDAR_READ_MODEL_TEST_SQL")"
  if [[ "$fixture_result" != *"HOTEL_CALENDAR_READ_MODEL_INTEGRATION_OK"* ]]; then
    printf '%s\n' "$fixture_result" >&2
    return 1
  fi
  api_probe_url="$(configure_api_probe_role "$admin_url")"
  grant_repair_lifecycle_capabilities "$admin_url"
  set +e
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$api_probe_url" \
      TEST_ADMIN_URL="$admin_url" \
      INSPECTION_FACILITY_SQL="$HOTEL_INSPECTION_FACILITY_EXECUTION_TEST_SQL" \
      pnpm exec tsx apps/api/test/calendar-read-model-actual-api-integration.ts
  )
  probe_status=$?
  set -e
  cleanup_api_probe_role "$admin_url"
  return "$probe_status"
}

run_actual_scheduled_reconciler_drain_barrier_probe() {
  local admin_url="$1" reconciler_url="$2" holder_name barrier_name holder_backend_pid barrier_backend_pid blockers observed probe
  local holder_log barrier_log holder_process_pid barrier_process_pid
  holder_name="gw_drain_holder_$$_${RANDOM}"
  barrier_name="gw_drain_barrier_$$_${RANDOM}"
  holder_log="$(mktemp)"
  barrier_log="$(mktemp)"
  PGAPPNAME="$holder_name" psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" >"$holder_log" 2>&1 <<'SQL' &
select public.scheduled_reconciler_invocation_enter_v1();
select pg_catalog.pg_sleep(3);
select public.scheduled_reconciler_invocation_exit_v1();
SQL
  holder_process_pid=$!
  holder_backend_pid=""
  for _ in $(seq 1 50); do
    holder_backend_pid="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -c "select activity.pid from pg_catalog.pg_stat_activity activity where activity.application_name='$holder_name' and exists(select 1 from pg_catalog.pg_locks held where held.pid=activity.pid and held.locktype='advisory' and held.mode='ShareLock' and held.granted)" || true)"
    [[ "$holder_backend_pid" =~ ^[0-9]+$ ]] && break
    sleep 0.05
  done
  if [[ ! "$holder_backend_pid" =~ ^[0-9]+$ ]]; then wait "$holder_process_pid" || true; cat "$holder_log" >&2; rm -f "$holder_log" "$barrier_log"; return 1; fi
  PGAPPNAME="$barrier_name" psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" -c 'select public.scheduled_reconciler_drain_barrier_v1()' >"$barrier_log" 2>&1 &
  barrier_process_pid=$!
  observed=false
  for _ in $(seq 1 50); do
    if ! kill -0 "$barrier_process_pid" 2>/dev/null; then
      wait "$barrier_process_pid" || true
      cat "$barrier_log" >&2
      wait "$holder_process_pid" || true
      rm -f "$holder_log" "$barrier_log"
      echo "scheduled reconciler drain barrier completed before blocker evidence" >&2
      return 1
    fi
    probe="$(psql -X -v ON_ERROR_STOP=1 -At -F '|' -d "$admin_url" -c "select barrier.pid,array_to_string(pg_catalog.pg_blocking_pids(barrier.pid),',') from pg_catalog.pg_stat_activity barrier where barrier.application_name='$barrier_name'" || true)"
    barrier_backend_pid="${probe%%|*}"
    blockers="${probe#*|}"
    if [[ "$barrier_backend_pid" =~ ^[0-9]+$ && "$blockers" == "$holder_backend_pid" ]]; then observed=true; break; fi
    sleep 0.05
  done
  if [[ "$observed" != "true" ]]; then
    kill "$barrier_process_pid" 2>/dev/null || true
    wait "$barrier_process_pid" || true
    wait "$holder_process_pid" || true
    cat "$holder_log" "$barrier_log" >&2
    rm -f "$holder_log" "$barrier_log"
    echo "scheduled reconciler drain barrier exact blocker relationship was not observed" >&2
    return 1
  fi
  wait "$holder_process_pid"
  wait "$barrier_process_pid"
  rm -f "$holder_log" "$barrier_log"
}

run_actual_google_calendar_projection_probe() {
  local admin_url="$1"
  local reconciler_url="$2"
  local api_probe_url fixture_result event_job_id actor_user_id reset_state
  fixture_result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -f "$GOOGLE_CALENDAR_PROJECTION_TEST_SQL")"
  if [[ "$fixture_result" != *"GOOGLE_CALENDAR_PROJECTION_FIXTURE_OK"* ]]; then
    printf '%s\n' "$fixture_result" >&2
    return 1
  fi
  api_probe_url="$(configure_api_probe_role "$admin_url")"
  grant_repair_lifecycle_capabilities "$admin_url"
  grant_google_calendar_reconciler_capabilities "$admin_url"
  actor_user_id="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -c "select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001'")"
  local direct_store_status
  set +e
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" -c "select public.repair_idempotency_store_v1('ca470000-0000-4000-8000-000000000090','10000000-0000-0000-0000-000000000001','$actor_user_id','forged-calendar-receipt','POST','/api/admin/calendar-connections/oauth/start',repeat('f',64),'CALENDAR_OAUTH_TRANSACTION','ca470000-0000-4000-8000-000000000091','ca470000-0000-4000-8000-000000000092','{\"status\":\"CREATED\",\"payload\":null}'::jsonb)" >/dev/null 2>&1
  direct_store_status=$?
  set -e
  if [[ "$direct_store_status" -eq 0 ]]; then
    printf 'Calendar idempotency store helper was directly executable by API runtime\n' >&2
    return 1
  fi
  printf '%s\n' 'GOOGLE_CALENDAR_IDEMPOTENCY_STORE_DIRECT_EXECUTE_DENIED_OK'
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$api_probe_url" TEST_CALENDAR_ACTOR_USER_ID="$actor_user_id" pnpm exec tsx <<'NODE'
import { createPostgresCalendarProjectionRepository } from "./packages/db/src/index.ts";
const repository = createPostgresCalendarProjectionRepository(process.env.TEST_READY_URL);
const actor = {
  companyId: "10000000-0000-0000-0000-000000000001",
  userId: process.env.TEST_CALENDAR_ACTOR_USER_ID,
  sessionId: "4f000000-0000-4000-8000-000000000001",
  sessionToken: "I".repeat(43),
};
try {
  const idempotency = {
    idempotencyKey: "calendar-actual-idempotency-key",
    idempotencyRecordId: "ca470000-0000-4000-8000-000000000001",
    operationPath: "/api/admin/calendar-connections/oauth/start",
    requestHash: "a".repeat(64),
    authorizationBranchId: null,
    authorizationPermission: "CALENDAR_CONNECTION_MANAGE",
    providerConnectionId: null,
  };
  const command = {
    ...actor,
    idempotency,
    transactionId: "ca470000-0000-4000-8000-000000000002",
    stateHash: new Uint8Array(32).fill(1),
    browserBindingHash: new Uint8Array(32).fill(2),
    nonceHash: new Uint8Array(32).fill(3),
    verifierCiphertext: new Uint8Array(48).fill(4),
    verifierIv: new Uint8Array(12).fill(5),
    keyVersion: 1,
    hmacKeyVersion: 1,
    returnPath: "/admin/calendar",
    reconnect: false,
    expectedConnectionVersion: null,
  };
  const created = await repository.oauthStart(command);
  const replayed = await repository.oauthStart({
    ...command,
    idempotency: { ...idempotency, idempotencyRecordId: "ca470000-0000-4000-8000-000000000003" },
  });
  const conflicted = await repository.oauthStart({
    ...command,
    idempotency: { ...idempotency, idempotencyRecordId: "ca470000-0000-4000-8000-000000000004", requestHash: "b".repeat(64) },
  });
  if (created.status !== "CREATED" || replayed.status !== "CREATED" || JSON.stringify(replayed.payload) !== JSON.stringify(created.payload) || conflicted.status !== "IDEMPOTENCY_CONFLICT")
    throw new Error("calendar idempotency actual replay/conflict contract failed");
} finally {
  await repository.close();
}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
delete from public.idempotency_records where idempotency_key='calendar-actual-idempotency-key';
delete from public.calendar_oauth_transactions where id='ca470000-0000-4000-8000-000000000002';
SQL
  printf '%s\n' 'GOOGLE_CALENDAR_IDEMPOTENCY_ACTUAL_DB_OK'
  run_waiting_routine_status() {
    local target_url="$1" application_base="$2" writer_application_name="$3" routine_sql="$4"
    local application_name routine_log routine_process_pid routine_waiting=false probe
    application_name="${application_base}_$$_${RANDOM}"
    if [[ ! "$application_name" =~ ^[a-z0-9_]{3,63}$ || ! "$writer_application_name" =~ ^[a-z0-9_]{3,63}$ ]]; then
      printf 'Invalid lock-wait application name\n' >&2
      return 1
    fi
    routine_log="$(mktemp)"
    (PGAPPNAME="$application_name" psql -XqAt -v ON_ERROR_STOP=1 -d "$target_url" -c "$routine_sql" >"$routine_log") &
    routine_process_pid="$!"
    for _ in $(seq 1 80); do
      if ! probe="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select count(*) from pg_catalog.pg_stat_activity routine join pg_catalog.pg_stat_activity writer on writer.application_name='$writer_application_name' and writer.pid=any(pg_catalog.pg_blocking_pids(routine.pid)) where routine.application_name='$application_name' and routine.wait_event_type='Lock'")"; then
        kill "$routine_process_pid" 2>/dev/null || true
        wait "$routine_process_pid" 2>/dev/null || true
        rm -f "$routine_log"
        printf 'Lock-wait probe failed: %s\n' "$application_name" >&2
        return 1
      fi
      if [[ "$probe" == "1" ]]; then routine_waiting=true; break; fi
      if [[ "$probe" != "0" ]]; then
        kill "$routine_process_pid" 2>/dev/null || true
        wait "$routine_process_pid" 2>/dev/null || true
        rm -f "$routine_log"
        printf 'Ambiguous lock-wait probe result: %s=%s\n' "$application_name" "$probe" >&2
        return 1
      fi
      if ! kill -0 "$routine_process_pid" 2>/dev/null; then break; fi
      sleep 0.1
    done
    if [[ "$routine_waiting" != "true" ]]; then
      wait "$routine_process_pid" 2>/dev/null || true
      rm -f "$routine_log"
      printf 'Routine did not reach expected writer-bound lock wait: %s\n' "$application_name" >&2
      return 1
    fi
    if ! wait "$routine_process_pid"; then
      rm -f "$routine_log"
      printf 'Lock-wait routine failed: %s\n' "$application_name" >&2
      return 1
    fi
    if ! tail -n 1 "$routine_log"; then rm -f "$routine_log"; return 1; fi
    rm -f "$routine_log"
  }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_recent_auth_claim$
declare result record;
begin
  update public.auth_sessions set auth_time=statement_timestamp() where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001';
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000011',decode(repeat('12',32),'hex'),decode(repeat('23',32),'hex'),decode(repeat('2f',32),'hex'),decode(repeat('34',32),'hex'),decode(repeat('45',12),'hex'),1,'/admin/calendar',false,null,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'recent-auth claim fixture start failed: %',result.command_status; end if;
  update public.auth_sessions set auth_time=statement_timestamp()-interval '16 minutes' where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001';
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('12',32),'hex'),decode(repeat('23',32),'hex'),decode(repeat('56',32),'hex'));
  if result.command_status<>'OAUTH_FLOW_INVALID' then raise exception 'stale recent-auth claim exposed PKCE material: %',result.command_status; end if;
  if exists(select 1 from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000011') then raise exception 'rejected OAuth claim remained replayable'; end if;
end
$oauth_recent_auth_claim$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $api_journey$
declare result record; claim_payload jsonb;
begin
  select * into result from public.calendar_connection_status_read_v1('10000000-0000-0000-0000-000000000001',repeat('I',43));
  if result.command_status<>'OK' or result.result_snapshot->>'connectionStatus'<>'NOT_CONNECTED' or result.result_snapshot->'version'<>'null'::jsonb or exists(select 1 from jsonb_array_elements(result.result_snapshot->'hotels') hotel where hotel->>'linkStatus'<>'NOT_CREATED') then raise exception 'initial Calendar status payload mismatch: %',result.result_snapshot; end if;
  select * into result from public.calendar_oauth_start_v1(
    '10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000012',
    decode(repeat('13',32),'hex'),decode(repeat('24',32),'hex'),decode(repeat('2e',32),'hex'),decode(repeat('35',32),'hex'),decode(repeat('46',12),'hex'),1,'/admin/calendar',false,null
  ,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'terminal OAuth fixture start failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('13',32),'hex'),decode(repeat('24',32),'hex'),decode(repeat('57',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'terminal OAuth fixture claim failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_fail_v1(null,decode(repeat('57',32),'hex'),'CALENDAR_OAUTH_FLOW_INVALID');
  if result.command_status<>'FAILED' then raise exception 'claim-token OAuth cleanup failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('13',32),'hex'),decode(repeat('24',32),'hex'),decode(repeat('68',32),'hex'));
  if result.command_status<>'OAUTH_FLOW_INVALID' then raise exception 'terminal OAuth row remained replayable'; end if;
  select * into result from public.calendar_oauth_start_v1(
    '10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000010',
    decode(repeat('11',32),'hex'),decode(repeat('22',32),'hex'),decode(repeat('2d',32),'hex'),decode(repeat('33',32),'hex'),decode(repeat('44',12),'hex'),1,'/admin/calendar',false,null
  ,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'oauth start failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('11',32),'hex'),decode(repeat('22',32),'hex'),decode(repeat('55',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'oauth claim failed: %',result.command_status; end if;
  claim_payload:=result.result_snapshot;
  if claim_payload->>'connectionId' is not null or (claim_payload->>'credentialVersion')::integer<>1 then raise exception 'oauth claim did not predeclare first credential AAD identity'; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('11',32),'hex'),decode(repeat('22',32),'hex'),decode(repeat('66',32),'hex'));
  if result.command_status<>'OAUTH_FLOW_INVALID' then raise exception 'oauth replay was not rejected'; end if;
  select * into result from public.calendar_oauth_finalize_v1(
    'ca440000-0000-4000-8000-000000000010',decode(repeat('55',32),'hex'),
    'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000021',1,
    decode(repeat('77',48),'hex'),decode(repeat('88',12),'hex'),1,decode(repeat('99',32),'hex'),1,
    array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]
  );
  if result.command_status<>'CONNECTED' then raise exception 'oauth finalize failed: %',result.command_status; end if;
  select * into result from public.calendar_hotel_link_command_v1(
    '10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020','50000000-0000-4000-8000-000000000001',repeat('I',43),'CREATE',2,0,1,
    'ca440000-0000-4000-8000-000000000030',decode(repeat('aa',48),'hex'),decode(repeat('bb',12),'hex'),1,decode(repeat('cc',32),'hex'),'실제 통합검증'
  ,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/hotel-link-command',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'hotel link create failed: %',result.command_status; end if;
  select * into result from public.calendar_connection_status_read_v1('10000000-0000-0000-0000-000000000001',repeat('I',43));
  if result.command_status<>'OK' or not exists(select 1 from jsonb_array_elements(result.result_snapshot->'hotels') hotel where hotel->>'hotelId'='50000000-0000-4000-8000-000000000001' and hotel->>'linkStatus'='PENDING' and hotel->>'projectionStatus'='PENDING') then raise exception 'pending Calendar status payload mismatch: %',result.result_snapshot; end if;
end
$api_journey$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
do $hotel_claim$
declare result record; job_id_value uuid;
begin
  select * into result from public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('dd',32),'hex'),1);
  if result.command_status<>'OK' or jsonb_array_length(result.result_snapshot->'jobs')<>1 then raise exception 'hotel projection claim failed'; end if;
  job_id_value:=(result.result_snapshot->'jobs'->0->>'id')::uuid;
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',job_id_value,decode(repeat('00',32),'hex'),'SUCCEEDED','CALENDAR_CREATE',null,null,decode(repeat('ee',48),'hex'),decode(repeat('ff',12),'hex'),1,null);
  if result.command_status<>'STALE_CLAIM' then raise exception 'wrong claim token was not fenced'; end if;
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',job_id_value,decode(repeat('dd',32),'hex'),'PREFLIGHT','NO_OP',null,null,null,null,null,null);
  if result.command_status<>'READY' then raise exception 'provider mutation preflight did not renew the live claim: %',result.command_status; end if;
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',job_id_value,decode(repeat('dd',32),'hex'),'SUCCEEDED','CALENDAR_CREATE',null,null,decode(repeat('ee',48),'hex'),decode(repeat('ff',12),'hex'),1,null);
  if result.command_status<>'VALIDATION_ERROR' then raise exception 'create finalize bypassed durable dispatch: %',result.command_status; end if;
  select * into result from public.calendar_projection_mark_create_dispatched_v1('10000000-0000-0000-0000-000000000001',job_id_value,decode(repeat('dd',32),'hex'));
  if result.command_status<>'DISPATCH_RECORDED' then raise exception 'create dispatch was not recorded: %',result.command_status; end if;
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',job_id_value,decode(repeat('dd',32),'hex'),'SUCCEEDED','CALENDAR_CREATE',null,null,decode(repeat('ee',48),'hex'),decode(repeat('ff',12),'hex'),1,null);
  if result.command_status<>'SUCCEEDED' then raise exception 'hotel projection finalize failed: %',result.command_status; end if;
end
$hotel_claim$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $candidate_oauth$
declare result record; claim_payload jsonb;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000040',decode(repeat('14',32),'hex'),decode(repeat('25',32),'hex'),decode(repeat('2c',32),'hex'),decode(repeat('36',32),'hex'),decode(repeat('47',12),'hex'),1,'/admin/calendar',true,2,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'candidate OAuth start failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('14',32),'hex'),decode(repeat('25',32),'hex'),decode(repeat('69',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'candidate OAuth claim failed: %',result.command_status; end if;
  claim_payload:=result.result_snapshot;
  if claim_payload->>'connectionId'<>'ca440000-0000-4000-8000-000000000020' or (claim_payload->>'connectionVersion')::integer<>2 or (claim_payload->>'credentialVersion')::integer<>2 then raise exception 'candidate AAD identity mismatch'; end if;
  select * into result from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000040',decode(repeat('69',32),'hex'),'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000022',2,decode(repeat('79',48),'hex'),decode(repeat('8a',12),'hex'),1,decode(repeat('9b',32),'hex'),1,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]);
  if result.command_status<>'CANDIDATE' then raise exception 'candidate OAuth finalize failed: %',result.command_status; end if;
end
$candidate_oauth$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.calendar_connection_credentials
set fingerprint_key_version=7
where company_id='10000000-0000-0000-0000-000000000001'
  and lifecycle in ('ACTIVE','CANDIDATE');
update public.calendar_crypto_settings
set current_hmac_key_version=7,updated_at=statement_timestamp()
where singleton;
insert into public.hotel_repair_visits(
  id,company_id,branch_id,repair_case_id,title,starts_at,ends_at,status,version,created_by
)
select
  'ca450000-0000-4000-8000-000000000001',visit.company_id,visit.branch_id,
  visit.repair_case_id,'HMAC rotation new marker probe',visit.starts_at+interval '25 years',
  visit.ends_at+interval '25 years','SCHEDULED',1,visit.created_by
from public.hotel_repair_visits visit
where visit.company_id='10000000-0000-0000-0000-000000000001'
  and visit.branch_id='50000000-0000-4000-8000-000000000001'
order by visit.created_at limit 1;
insert into public.hotel_repair_visit_performers(
  id,company_id,branch_id,repair_visit_id,performer_type,internal_user_id
)
select
  'ca450000-0000-4000-8000-000000000002',visit.company_id,visit.branch_id,visit.id,
  'INTERNAL','2f000000-0000-4000-8000-000000000001'
from public.hotel_repair_visits visit
where visit.id='ca450000-0000-4000-8000-000000000001';
do $hmac_rotation_marker$
begin
  if not exists(
    select 1 from public.calendar_event_links
    where visit_id='ca450000-0000-4000-8000-000000000001'
      and marker_key_version=7
  ) then raise exception 'new event marker did not use current HMAC key version'; end if;
  update public.calendar_projection_jobs
  set available_at='1900-01-01 00:00:00+00',updated_at=statement_timestamp()
  where event_link_id=(select id from public.calendar_event_links where visit_id='ca450000-0000-4000-8000-000000000001')
    and status='PENDING';
end
$hmac_rotation_marker$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
do $uncertain_create_dispatch$
declare result record; target_job jsonb;
begin
  select * into result from public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('d1',32),'hex'),1);
  target_job:=result.result_snapshot->'jobs'->0;
  if result.command_status<>'OK' or target_job->'visit'->>'id'<>'ca450000-0000-4000-8000-000000000001' or (target_job->>'attemptedSourceVersion')::integer<>1 or (target_job->'visit'->>'version')::integer<>1 then raise exception 'uncertain create initial immutable claim mismatch: %',target_job; end if;
  select * into result from public.calendar_projection_mark_create_dispatched_v1('10000000-0000-0000-0000-000000000001',(target_job->>'id')::uuid,decode(repeat('d1',32),'hex'));
  if result.command_status<>'DISPATCH_RECORDED' then raise exception 'uncertain create dispatch was not durable'; end if;
end
$uncertain_create_dispatch$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.hotel_repair_visits set starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour',version=version+1 where id='ca450000-0000-4000-8000-000000000001';
update public.calendar_projection_jobs set claim_expires_at=statement_timestamp()-interval '1 second' where event_link_id=(select id from public.calendar_event_links where visit_id='ca450000-0000-4000-8000-000000000001') and status='PROCESSING';
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
do $uncertain_create_reclaim$
declare result record; target_job jsonb;
begin
  select * into result from public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('d2',32),'hex'),1);
  target_job:=result.result_snapshot->'jobs'->0;
  if result.command_status<>'OK' or target_job->>'createDispatchState'<>'CREATE_DISPATCHED_OUTCOME_UNKNOWN' or (target_job->>'desiredSourceVersion')::integer<>2 or (target_job->>'attemptedSourceVersion')::integer<>1 or (target_job->'visit'->>'version')::integer<>1 then raise exception 'uncertain create reclaim overwrote dispatch snapshot: %',target_job; end if;
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',(target_job->>'id')::uuid,decode(repeat('d2',32),'hex'),'SUCCEEDED','EVENT_READ_BACK',null,null,null,null,null,1);
  if result.command_status<>'STALE_VERSION' or coalesce((result.result_snapshot->>'providerOutcomeConfirmed')::boolean,false) is not true then raise exception 'old provider outcome was not confirmed as stale: % %',result.command_status,result.result_snapshot; end if;
end
$uncertain_create_reclaim$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $uncertain_create_transition$
declare event_id_value uuid;
begin
  select id into event_id_value from public.calendar_event_links where visit_id='ca450000-0000-4000-8000-000000000001';
  if not exists(select 1 from public.calendar_event_links where id=event_id_value and desired_source_version=2 and applied_source_version=1 and applied_exists and status='PENDING') then raise exception 'old provider outcome advanced canonical source incorrectly'; end if;
  if not exists(select 1 from public.calendar_projection_jobs where event_link_id=event_id_value and status='SUPERSEDED' and attempted_source_version=1 and create_dispatch_state='CREATE_CONFIRMED') then raise exception 'old uncertain job was not retained as confirmed superseded evidence'; end if;
  if (select count(*) from public.calendar_projection_jobs where event_link_id=event_id_value and status='PENDING' and attempted_source_version=2 and create_dispatch_state='CREATE_CONFIRMED')<>1 then raise exception 'fresh update generation was not created exactly once'; end if;
  update public.calendar_projection_jobs set status='SUPERSEDED',completed_at=statement_timestamp(),updated_at=statement_timestamp() where event_link_id=event_id_value and status in ('PENDING','FAILED');
  update public.calendar_event_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where id=event_id_value;
end
$uncertain_create_transition$;
SQL
  printf '%s\n' 'GOOGLE_CALENDAR_UNCERTAIN_CREATE_SOURCE_ADVANCE_OK'
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
do $candidate_verification$
declare result record; candidate_snapshot jsonb;
begin
  select * into result from public.calendar_candidate_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('ac',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'candidate verification claim failed: %',result.command_status; end if;
  candidate_snapshot:=result.result_snapshot->'candidate';
  if jsonb_array_length(candidate_snapshot->'links')<>1 then raise exception 'candidate verification omitted active Calendar links'; end if;
  if length(candidate_snapshot->>'credentialFingerprint')=0 or length(candidate_snapshot->>'activeCredentialFingerprint')=0 then raise exception 'candidate verification omitted principal fingerprints'; end if;
  if (candidate_snapshot->>'credentialFingerprintKeyVersion')::integer<>7 or (candidate_snapshot->>'activeCredentialFingerprintKeyVersion')::integer<>7 then raise exception 'candidate verification lost retained principal fingerprint key versions: %',candidate_snapshot; end if;
  select * into result from public.calendar_candidate_finalize_v1('10000000-0000-0000-0000-000000000001',(candidate_snapshot->>'candidateId')::uuid,decode(repeat('ac',32),'hex'),(candidate_snapshot->>'candidateRowVersion')::integer,(candidate_snapshot->>'connectionVersion')::integer,'ACCESS_VERIFIED',null,null);
  if result.command_status<>'ACCESS_VERIFIED' then raise exception 'candidate verification finalize failed: %',result.command_status; end if;
end
$candidate_verification$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $candidate_not_auto_promoted$
begin
  if not exists(select 1 from public.calendar_connections where company_id='10000000-0000-0000-0000-000000000001' and active_credential_id='ca440000-0000-4000-8000-000000000021') then raise exception 'candidate was auto-promoted'; end if;
  if not exists(select 1 from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000022' and lifecycle='ACCESS_VERIFIED') then raise exception 'candidate did not reach ACCESS_VERIFIED'; end if;
  if exists(select 1 from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000012') or not exists(select 1 from public.audit_events where resource_id='ca440000-0000-4000-8000-000000000012' and event_code='CALENDAR_CONNECTION_OAUTH_FAILED') then raise exception 'terminal OAuth cleanup/audit mismatch'; end if;
end
$candidate_not_auto_promoted$;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_connection_credentials set lifecycle='ACCOUNT_CHANGE_REQUIRES_CONFIRMATION' where id='ca440000-0000-4000-8000-000000000022'" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $account_change_generation$
declare result record;
begin
  select * into result from public.calendar_connection_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',repeat('I',43),'CONFIRM_ACCOUNT_CHANGE',2,'ca440000-0000-4000-8000-000000000022',2,jsonb_build_array(jsonb_build_object('hotelId','50000000-0000-4000-8000-000000000001','expectedHotelLinkId','ca440000-0000-4000-8000-000000000030','expectedGeneration',1,'linkId','ca440000-0000-4000-8000-000000000031','generation',2,'lookupCiphertext',encode(decode(repeat('ad',48),'hex'),'base64'),'lookupIv',encode(decode(repeat('be',12),'hex'),'base64'),'keyVersion',1,'lookupDigest',encode(decode(repeat('cf',32),'hex'),'base64'))),'계정변경 generation 검증',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/connection-command',md5(gen_random_uuid()::text));
  if result.command_status<>'VERSION_CONFLICT' then raise exception 'stale candidate row was not fenced: %',result.command_status; end if;
  select * into result from public.calendar_connection_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',repeat('I',43),'CONFIRM_ACCOUNT_CHANGE',2,'ca440000-0000-4000-8000-000000000022',3,jsonb_build_array(jsonb_build_object('hotelId','50000000-0000-4000-8000-000000000001','expectedHotelLinkId','ca440000-0000-4000-8000-000000000030','expectedGeneration',1,'linkId','ca440000-0000-4000-8000-000000000031','generation',2,'lookupCiphertext',encode(decode(repeat('ad',48),'hex'),'base64'),'lookupIv',encode(decode(repeat('be',12),'hex'),'base64'),'keyVersion',1,'lookupDigest',encode(decode(repeat('cf',32),'hex'),'base64'))),'계정변경 generation 검증',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/connection-command',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' or result.result_snapshot->>'credentialStatus'<>'ACTIVE' or result.result_snapshot->>'version'<>'3' then raise exception 'account change command failed: % %',result.command_status,result.result_snapshot; end if;
  if not exists(select 1 from jsonb_array_elements(result.result_snapshot->'hotels') hotel where hotel->>'hotelLinkId'='ca440000-0000-4000-8000-000000000031' and hotel->>'generation'='2' and hotel->>'linkStatus'='PENDING') then raise exception 'account change did not return fresh generation'; end if;
end
$account_change_generation$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.calendar_event_links set status='PENDING',version=version+1,updated_at=statement_timestamp() where visit_id='ca450000-0000-4000-8000-000000000001';
insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,event_link_id,attempted_source_version,attempted_starts_at,attempted_ends_at,attempted_visit_status,attempted_connection_version,attempted_hotel_link_generation,attempted_hotel_link_version,attempted_event_link_version,attempted_credential_id,attempted_credential_version,create_dispatch_state)
select 'ca460000-0000-4000-8000-000000000099',event_record.company_id,event_record.branch_id,'VISIT_EVENT',event_record.id,visit_record.version,visit_record.starts_at,visit_record.ends_at,visit_record.status,connection_record.version,hotel_link.generation,hotel_link.version,event_record.version,credential_record.id,credential_record.credential_version,'CREATE_DISPATCHED_OUTCOME_UNKNOWN'
from public.calendar_event_links event_record join public.hotel_repair_visits visit_record on visit_record.id=event_record.visit_id join public.calendar_hotel_links hotel_link on hotel_link.id=event_record.hotel_link_id join public.calendar_connections connection_record on connection_record.id=hotel_link.connection_id join public.calendar_connection_credentials credential_record on credential_record.id=connection_record.active_credential_id where event_record.visit_id='ca450000-0000-4000-8000-000000000001';
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $uncertain_event_promote_block$
declare result record;
begin
  select * into result from public.calendar_connection_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',repeat('I',43),'PROMOTE_CANDIDATE',2,'ca440000-0000-4000-8000-000000000022',3,'[]'::jsonb,'불확정 생성 중 승격 차단',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/connection-command',md5(gen_random_uuid()::text));
  if result.command_status<>'VERSION_CONFLICT' then raise exception 'uncertain event create did not block promotion: %',result.command_status; end if;
end
$uncertain_event_promote_block$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.calendar_projection_jobs set status='SUPERSEDED',completed_at=statement_timestamp(),updated_at=statement_timestamp() where id='ca460000-0000-4000-8000-000000000099';
update public.calendar_event_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where visit_id='ca450000-0000-4000-8000-000000000001';
commit;
SQL
  printf '%s\n' 'GOOGLE_CALENDAR_UNCERTAIN_CREATE_PROMOTION_BLOCKED_OK'
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_connection_credentials set lifecycle='ACCESS_VERIFIED' where id='ca440000-0000-4000-8000-000000000022'" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $candidate_promote$
declare result record;
begin
  select * into result from public.calendar_connection_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',repeat('I',43),'PROMOTE_CANDIDATE',2,'ca440000-0000-4000-8000-000000000022',3,'[]'::jsonb,'검증 후보 승격',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/connection-command',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' or result.result_snapshot->>'credentialStatus'<>'ACTIVE' then raise exception 'explicit candidate promotion failed: %',result.command_status; end if;
end
$candidate_promote$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_version_start$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000042',decode(repeat('15',32),'hex'),decode(repeat('26',32),'hex'),decode(repeat('37',32),'hex'),decode(repeat('48',32),'hex'),decode(repeat('59',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'OAuth version-race start failed: %',result.command_status; end if;
end
$oauth_version_start$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_connections set version=version+1 where company_id='10000000-0000-0000-0000-000000000001'" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
do $oauth_version_claim$
declare result record;
begin
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('15',32),'hex'),decode(repeat('26',32),'hex'),decode(repeat('6a',32),'hex'));
  if result.command_status<>'OAUTH_FLOW_INVALID' then raise exception 'connection version race was not fenced: %',result.command_status; end if;
end
$oauth_version_claim$;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_connections set version=version-1 where company_id='10000000-0000-0000-0000-000000000001'; delete from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000042'" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_assignment_start$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000043',decode(repeat('16',32),'hex'),decode(repeat('27',32),'hex'),decode(repeat('38',32),'hex'),decode(repeat('49',32),'hex'),decode(repeat('5a',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'OAuth assignment-race start failed: %',result.command_status; end if;
end
$oauth_assignment_start$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date-1,end_date=(statement_timestamp() at time zone 'Asia/Seoul')::date-1 where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001') and end_date is null;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $assignment_revoked$
declare result record;
begin
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('16',32),'hex'),decode(repeat('27',32),'hex'),decode(repeat('6b',32),'hex'));
  if result.command_status<>'OAUTH_FLOW_INVALID' then raise exception 'revoked hotel assignment allowed OAuth claim: %',result.command_status; end if;
  select * into result from public.calendar_connection_status_read_v1('10000000-0000-0000-0000-000000000001',repeat('I',43));
  if result.command_status<>'OK' or jsonb_array_length(result.result_snapshot->'hotels')<>0 then raise exception 'revoked hotel assignment leaked Calendar status'; end if;
  select * into result from public.calendar_hotel_link_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020','50000000-0000-4000-8000-000000000001',repeat('I',43),'RETRY',3,2,0,gen_random_uuid(),decode(repeat('01',32),'hex'),decode(repeat('02',12),'hex'),1,decode(repeat('03',32),'hex'),'배정회수 차단',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/hotel-link-command',md5(gen_random_uuid()::text));
  if result.command_status<>'FORBIDDEN' then raise exception 'revoked hotel assignment allowed link mutation: %',result.command_status; end if;
  select * into result from public.calendar_connection_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',repeat('I',43),'DISCONNECT',3,null,null,'[]'::jsonb,'배정회수 차단',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/connection-command',md5(gen_random_uuid()::text));
  if result.command_status<>'FORBIDDEN' then raise exception 'revoked hotel assignment allowed company mutation: %',result.command_status; end if;
end
$assignment_revoked$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000043'" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date,end_date=null where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
SQL
  (
    psql -XqAt -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $calendar_assignment_lock$
declare result record;
begin
  select * into result from public.calendar_connection_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',repeat('I',43),'DISCONNECT',3,null,null,'[]'::jsonb,'배정경합 잠금 검증',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/connection-command',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' then raise exception 'Calendar assignment lock fixture failed: %',result.command_status; end if;
end
$calendar_assignment_lock$;
select pg_advisory_xact_lock(4242424242);
select pg_sleep(5);
rollback;
SQL
  ) &
  local calendar_assignment_lock_pid="$!"
  local calendar_assignment_lock_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424242)')" == "f" ]]; then
      calendar_assignment_lock_ready=true
      break
    fi
    sleep 0.1
  done
  if [[ "$calendar_assignment_lock_ready" != "true" ]]; then
    wait "$calendar_assignment_lock_pid" || true
    printf 'Calendar assignment lock fixture did not become ready\n' >&2
    return 1
  fi
  if psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null 2>&1 <<'SQL'
set statement_timeout='500ms';
update public.hotel_staff_assignments
set end_date=(statement_timestamp() at time zone 'Asia/Seoul')::date-1
where company_id='10000000-0000-0000-0000-000000000001'
  and branch_id='50000000-0000-4000-8000-000000000001'
  and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
SQL
  then
    wait "$calendar_assignment_lock_pid" || true
    printf 'Assignment termination was not blocked by Calendar mutation\n' >&2
    return 1
  fi
  wait "$calendar_assignment_lock_pid"
  printf 'GOOGLE_CALENDAR_ASSIGNMENT_MUTATION_LOCK_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_finalize_lock_setup$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000099',decode(repeat('71',32),'hex'),decode(repeat('72',32),'hex'),decode(repeat('73',32),'hex'),decode(repeat('74',32),'hex'),decode(repeat('75',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'OAuth finalize lock setup start failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('71',32),'hex'),decode(repeat('72',32),'hex'),decode(repeat('76',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'OAuth finalize lock setup claim failed: %',result.command_status; end if;
end
$oauth_finalize_lock_setup$;
commit;
SQL
  (
    psql -XqAt -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_finalize_lock$
declare result record;
begin
  select * into result from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000099',decode(repeat('76',32),'hex'),'ca440000-0000-4000-8000-000000000020',gen_random_uuid(),3,decode(repeat('77',32),'hex'),decode(repeat('78',12),'hex'),1,decode(repeat('79',32),'hex'),1,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]);
  if result.command_status<>'CANDIDATE' then raise exception 'OAuth success-path finalize lock fixture failed: %',result.command_status; end if;
end
$oauth_finalize_lock$;
select pg_advisory_xact_lock(4242424243);
select pg_sleep(7);
rollback;
SQL
  ) &
  local oauth_finalize_lock_pid="$!"
  local oauth_finalize_lock_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424243)')" == "f" ]]; then
      oauth_finalize_lock_ready=true
      break
    fi
    sleep 0.1
  done
  if [[ "$oauth_finalize_lock_ready" != "true" ]]; then
    wait "$oauth_finalize_lock_pid" || true
    printf 'OAuth finalize authorization lock fixture did not become ready\n' >&2
    return 1
  fi
  if psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null 2>&1 <<'SQL'
set statement_timeout='500ms';
update public.hotel_staff_assignments
set end_date=(statement_timestamp() at time zone 'Asia/Seoul')::date-1
where company_id='10000000-0000-0000-0000-000000000001'
  and branch_id='50000000-0000-4000-8000-000000000001'
  and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
SQL
  then
    wait "$oauth_finalize_lock_pid" || true
    printf 'Assignment termination was not blocked by OAuth finalize\n' >&2
    return 1
  fi
  local lock_matrix_sql
  for lock_matrix_sql in \
    "update public.auth_sessions set revoked_at=statement_timestamp() where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001'" \
    "update public.users set status='INACTIVE' where company_id='10000000-0000-0000-0000-000000000001' and id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001')" \
    "update public.companies set status='SUSPENDED' where id='10000000-0000-0000-0000-000000000001'" \
    "update public.branches set status='INACTIVE' where company_id='10000000-0000-0000-0000-000000000001' and id='50000000-0000-4000-8000-000000000001'" \
    "update public.hotel_profiles set hotel_status='INACTIVE' where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001'" \
    "update public.calendar_hotel_links set status='ACTION_REQUIRED' where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and status<>'DISCONNECTED'" \
    "update public.permission_grants set valid_until=valid_until where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.user_role_memberships set valid_until=valid_until where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.roles set status=status where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.user_group_memberships set valid_until=valid_until where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.user_groups set status=status where company_id='10000000-0000-0000-0000-000000000001'"
  do
    if psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "set statement_timeout='500ms'; $lock_matrix_sql" >/dev/null 2>&1; then
      wait "$oauth_finalize_lock_pid" || true
      printf 'Authorization mutation was not blocked by successful OAuth finalize\n' >&2
      return 1
    fi
  done
  wait "$oauth_finalize_lock_pid"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000099'" >/dev/null
  printf 'GOOGLE_CALENDAR_OAUTH_SUCCESS_PATH_LOCK_MATRIX_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
select * from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000097',decode(repeat('87',32),'hex'),decode(repeat('88',32),'hex'),decode(repeat('89',32),'hex'),decode(repeat('8a',32),'hex'),decode(repeat('8b',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
commit;
SQL
  (
    psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select pg_advisory_xact_lock(pg_catalog.hashtextextended('10000000-0000-0000-0000-000000000001',0));
select pg_advisory_xact_lock(4242424246);
select pg_sleep(3);
rollback;
SQL
  ) &
  local oauth_company_lock_pid="$!" oauth_company_lock_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424246)')" == "f" ]]; then oauth_company_lock_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$oauth_company_lock_ready" != "true" ]]; then wait "$oauth_company_lock_pid" || true; printf 'OAuth company lock-order fixture did not become ready\n' >&2; return 1; fi
  local oauth_claim_log
  oauth_claim_log="$(mktemp)"
  (psql -XqAt -v ON_ERROR_STOP=1 -d "$api_probe_url" -c "select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',false); select command_status from public.calendar_oauth_claim_v1(decode(repeat('87',32),'hex'),decode(repeat('88',32),'hex'),decode(repeat('8c',32),'hex'));" >"$oauth_claim_log") &
  local oauth_claim_pid="$!" oauth_claim_waiting=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select count(*) from pg_catalog.pg_stat_activity where usename='gw_api_probe' and query like '%calendar_oauth_claim_v1%' and wait_event_type='Lock'")" != "0" ]]; then oauth_claim_waiting=true; break; fi
    sleep 0.1
  done
  if [[ "$oauth_claim_waiting" != "true" ]]; then wait "$oauth_company_lock_pid" || true; wait "$oauth_claim_pid" || true; rm -f "$oauth_claim_log"; printf 'OAuth claim did not wait on company lock\n' >&2; return 1; fi
  if ! psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "begin; select 1 from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000097' for update nowait; rollback;" >/dev/null 2>&1; then
    wait "$oauth_company_lock_pid" || true; wait "$oauth_claim_pid" || true; rm -f "$oauth_claim_log"; printf 'OAuth claim locked transaction row before company lock\n' >&2; return 1
  fi
  wait "$oauth_company_lock_pid"
  wait "$oauth_claim_pid"
  if [[ "$(tail -n 1 "$oauth_claim_log")" != "CLAIMED" ]]; then rm -f "$oauth_claim_log"; printf 'OAuth lock-order claim did not complete\n' >&2; return 1; fi
  rm -f "$oauth_claim_log"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000097'" >/dev/null
  printf 'GOOGLE_CALENDAR_OAUTH_LOCK_ORDER_DEADLOCK_REGRESSION_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
select * from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000095',decode(repeat('8d',32),'hex'),decode(repeat('8e',32),'hex'),decode(repeat('8f',32),'hex'),decode(repeat('90',32),'hex'),decode(repeat('91',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
commit;
SQL
  (
    psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select pg_advisory_xact_lock(pg_catalog.hashtextextended('10000000-0000-0000-0000-000000000001:50000000-0000-4000-8000-000000000001',0));
select pg_advisory_xact_lock(4242424248);
select pg_sleep(3);
rollback;
SQL
  ) &
  local branch_lock_pid="$!" branch_lock_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424248)')" == "f" ]]; then branch_lock_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$branch_lock_ready" != "true" ]]; then wait "$branch_lock_pid" || true; printf 'Branch lock-order fixture did not become ready\n' >&2; return 1; fi
  local branch_claim_log
  branch_claim_log="$(mktemp)"
  (psql -XqAt -v ON_ERROR_STOP=1 -d "$api_probe_url" -c "select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',false); select command_status from public.calendar_oauth_claim_v1(decode(repeat('8d',32),'hex'),decode(repeat('8e',32),'hex'),decode(repeat('92',32),'hex'));" >"$branch_claim_log") &
  local branch_claim_pid="$!" branch_claim_waiting=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select count(*) from pg_catalog.pg_stat_activity where usename='gw_api_probe' and query like '%calendar_oauth_claim_v1%' and wait_event_type='Lock'")" != "0" ]]; then branch_claim_waiting=true; break; fi
    sleep 0.1
  done
  if [[ "$branch_claim_waiting" != "true" ]]; then wait "$branch_lock_pid" || true; wait "$branch_claim_pid" || true; rm -f "$branch_claim_log"; printf 'OAuth claim did not wait on branch lock\n' >&2; return 1; fi
  if ! psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "set statement_timeout='500ms'; update public.permission_grants set valid_until=valid_until where company_id='10000000-0000-0000-0000-000000000001'" >/dev/null 2>&1; then
    wait "$branch_lock_pid" || true; wait "$branch_claim_pid" || true; rm -f "$branch_claim_log"; printf 'OAuth claim locked permission tables before branch advisory lock\n' >&2; return 1
  fi
  wait "$branch_lock_pid"
  wait "$branch_claim_pid"
  if [[ "$(tail -n 1 "$branch_claim_log")" != "CLAIMED" ]]; then rm -f "$branch_claim_log"; printf 'Branch lock-order claim did not complete\n' >&2; return 1; fi
  rm -f "$branch_claim_log"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000095'" >/dev/null
  printf 'GOOGLE_CALENDAR_BRANCH_PERMISSION_LOCK_ORDER_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_terminal_erasure$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000094',decode(repeat('a1',32),'hex'),decode(repeat('a2',32),'hex'),decode(repeat('a3',32),'hex'),decode(repeat('a4',32),'hex'),decode(repeat('a5',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'terminal erasure version setup failed'; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('a1',32),'hex'),decode(repeat('a2',32),'hex'),decode(repeat('a6',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'terminal erasure version claim failed'; end if;
  select * into result from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000094',decode(repeat('a6',32),'hex'),'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000024',99,decode(repeat('a7',48),'hex'),decode(repeat('a8',12),'hex'),1,decode(repeat('a9',32),'hex'),7,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]);
  if result.command_status<>'VERSION_CONFLICT' then raise exception 'version conflict finalize status mismatch: %',result.command_status; end if;
end
$oauth_terminal_erasure$;
commit;
SQL
  if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select ((select count(*) from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000094')=0 and (select count(*) from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000024')=0)::text")" != "true" ]]; then printf 'Version conflict retained OAuth material or credential\n' >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_terminal_fingerprint$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000093',decode(repeat('b1',32),'hex'),decode(repeat('b2',32),'hex'),decode(repeat('b3',32),'hex'),decode(repeat('b4',32),'hex'),decode(repeat('b5',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'terminal erasure fingerprint setup failed'; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('b1',32),'hex'),decode(repeat('b2',32),'hex'),decode(repeat('b6',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'terminal erasure fingerprint claim failed'; end if;
  select * into result from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000093',decode(repeat('b6',32),'hex'),'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000025',3,decode(repeat('b7',48),'hex'),decode(repeat('b8',12),'hex'),1,decode(repeat('b9',32),'hex'),0,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]);
  if result.command_status<>'VALIDATION_ERROR' then raise exception 'fingerprint validation finalize status mismatch: %',result.command_status; end if;
end
$oauth_terminal_fingerprint$;
commit;
SQL
  if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select ((select count(*) from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000093')=0 and (select count(*) from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000025')=0)::text")" != "true" ]]; then printf 'Fingerprint validation retained OAuth material or credential\n' >&2; return 1; fi
  printf 'GOOGLE_CALENDAR_OAUTH_TERMINAL_ERASURE_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_permission_revoke_setup$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000092',decode(repeat('c1',32),'hex'),decode(repeat('c2',32),'hex'),decode(repeat('c3',32),'hex'),decode(repeat('c4',32),'hex'),decode(repeat('c5',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'permission revoke OAuth start failed'; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('c1',32),'hex'),decode(repeat('c2',32),'hex'),decode(repeat('c6',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'permission revoke OAuth claim failed'; end if;
end
$oauth_permission_revoke_setup$;
commit;
SQL
  local oauth_finalize_deny_writer="oauth_finalize_deny_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$oauth_finalize_deny_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select pg_advisory_xact_lock(pg_catalog.hashtextextended('10000000-0000-0000-0000-000000000001',0));
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
select 'ca440000-0000-4000-8000-000000000090','10000000-0000-0000-0000-000000000001',null,'USER',session_record.user_id,'CALENDAR_CONNECTION_MANAGE','DENY',statement_timestamp()-interval '1 minute',session_record.user_id,'OAuth revoke-first permission fence'
from public.auth_sessions session_record where session_record.company_id='10000000-0000-0000-0000-000000000001' and session_record.id='4f000000-0000-4000-8000-000000000001';
select pg_advisory_xact_lock(4242424249);
select pg_sleep(10);
commit;
SQL
  ) &
  local oauth_permission_revoke_pid="$!" oauth_permission_revoke_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424249)')" == "f" ]]; then oauth_permission_revoke_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$oauth_permission_revoke_ready" != "true" ]]; then wait "$oauth_permission_revoke_pid" || true; printf 'OAuth permission revoke fixture did not become ready\n' >&2; return 1; fi
  local oauth_permission_revoke_status
  if ! oauth_permission_revoke_status="$(run_waiting_routine_status "$api_probe_url" "oauth_finalize_deny_wait" "$oauth_finalize_deny_writer" "select command_status from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000092',decode(repeat('c6',32),'hex'),'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000026',3,decode(repeat('c7',48),'hex'),decode(repeat('c8',12),'hex'),1,decode(repeat('c9',32),'hex'),7,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]);")"; then return 1; fi
  wait "$oauth_permission_revoke_pid"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.permission_grants where id='ca440000-0000-4000-8000-000000000090'" >/dev/null
  if [[ "$oauth_permission_revoke_status" != "FORBIDDEN" ]] || [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select ((select count(*) from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000092')=0 and (select count(*) from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000026')=0)::text")" != "true" ]]; then printf 'OAuth permission revoke-first did not fail and erase atomically\n' >&2; return 1; fi
  printf 'GOOGLE_CALENDAR_OAUTH_PERMISSION_REVOKE_FIRST_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_finalize_assignment_setup$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000086',decode(repeat('e1',32),'hex'),decode(repeat('e2',32),'hex'),decode(repeat('e3',32),'hex'),decode(repeat('e4',32),'hex'),decode(repeat('e5',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'OAuth finalize assignment setup failed'; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('e1',32),'hex'),decode(repeat('e2',32),'hex'),decode(repeat('e6',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'OAuth finalize assignment claim failed'; end if;
end
$oauth_finalize_assignment_setup$;
commit;
SQL
  local oauth_finalize_assignment_writer="oauth_finalize_assignment_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$oauth_finalize_assignment_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date+1 where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
select pg_advisory_xact_lock(4242424255);
select pg_sleep(10);
commit;
SQL
  ) &
  local oauth_finalize_assignment_pid="$!" oauth_finalize_assignment_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424255)')" == "f" ]]; then oauth_finalize_assignment_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$oauth_finalize_assignment_ready" != "true" ]]; then wait "$oauth_finalize_assignment_pid" || true; printf 'OAuth finalize assignment revoke fixture did not become ready\n' >&2; return 1; fi
  local oauth_finalize_assignment_status
  if ! oauth_finalize_assignment_status="$(run_waiting_routine_status "$api_probe_url" "oauth_finalize_assignment_wait" "$oauth_finalize_assignment_writer" "select command_status from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000086',decode(repeat('e6',32),'hex'),'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000027',3,decode(repeat('e7',48),'hex'),decode(repeat('e8',12),'hex'),1,decode(repeat('e9',32),'hex'),7,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]);")"; then return 1; fi
  wait "$oauth_finalize_assignment_pid"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date,end_date=null where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001')" >/dev/null
  if [[ "$oauth_finalize_assignment_status" != "FORBIDDEN" ]] || [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select ((select count(*) from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000086')=0 and (select count(*) from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000027')=0)::text")" != "true" ]]; then printf 'Assignment revoke allowed OAuth finalize or retained mutation material\n' >&2; return 1; fi
  printf 'GOOGLE_CALENDAR_OAUTH_FINALIZE_ASSIGNMENT_REVOKE_FIRST_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_revoke_first_setup$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000098',decode(repeat('81',32),'hex'),decode(repeat('82',32),'hex'),decode(repeat('83',32),'hex'),decode(repeat('84',32),'hex'),decode(repeat('85',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'OAuth revoke-first setup failed: %',result.command_status; end if;
end
$oauth_revoke_first_setup$;
commit;
SQL
  local oauth_claim_assignment_writer="oauth_claim_assignment_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$oauth_claim_assignment_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.hotel_staff_assignments
set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date+1
where company_id='10000000-0000-0000-0000-000000000001'
  and branch_id='50000000-0000-4000-8000-000000000001'
  and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
select pg_advisory_xact_lock(4242424244);
select pg_sleep(10);
commit;
SQL
  ) &
  local oauth_revoke_first_pid="$!"
  local oauth_revoke_first_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424244)')" == "f" ]]; then oauth_revoke_first_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$oauth_revoke_first_ready" != "true" ]]; then wait "$oauth_revoke_first_pid" || true; printf 'OAuth revoke-first fixture did not become ready\n' >&2; return 1; fi
  local oauth_revoke_first_status
  if ! oauth_revoke_first_status="$(run_waiting_routine_status "$api_probe_url" "oauth_claim_assignment_wait" "$oauth_claim_assignment_writer" "select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',false); select command_status from public.calendar_oauth_claim_v1(decode(repeat('81',32),'hex'),decode(repeat('82',32),'hex'),decode(repeat('86',32),'hex'));")"; then return 1; fi
  wait "$oauth_revoke_first_pid"
  if [[ "$oauth_revoke_first_status" != "OAUTH_FLOW_INVALID" ]] || [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select count(*) from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000098'")" != "0" ]]; then
    printf 'OAuth revoke-first cleanup failed\n' >&2; return 1
  fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date,end_date=null where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001')" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
select * from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000087',decode(repeat('d1',32),'hex'),decode(repeat('d2',32),'hex'),decode(repeat('d3',32),'hex'),decode(repeat('d4',32),'hex'),decode(repeat('d5',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
commit;
SQL
  local oauth_claim_deny_writer="oauth_claim_deny_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$oauth_claim_deny_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select pg_advisory_xact_lock(pg_catalog.hashtextextended('10000000-0000-0000-0000-000000000001',0));
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
select 'ca440000-0000-4000-8000-000000000087','10000000-0000-0000-0000-000000000001',null,'USER',session_record.user_id,'CALENDAR_CONNECTION_MANAGE','DENY',statement_timestamp()-interval '1 minute',session_record.user_id,'OAuth claim revoke-first permission fence'
from public.auth_sessions session_record where session_record.company_id='10000000-0000-0000-0000-000000000001' and session_record.id='4f000000-0000-4000-8000-000000000001';
select pg_advisory_xact_lock(4242424254);
select pg_sleep(10);
commit;
SQL
  ) &
  local oauth_claim_permission_pid="$!" oauth_claim_permission_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424254)')" == "f" ]]; then oauth_claim_permission_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$oauth_claim_permission_ready" != "true" ]]; then wait "$oauth_claim_permission_pid" || true; printf 'OAuth claim permission revoke fixture did not become ready\n' >&2; return 1; fi
  local oauth_claim_permission_status
  if ! oauth_claim_permission_status="$(run_waiting_routine_status "$api_probe_url" "oauth_claim_deny_wait" "$oauth_claim_deny_writer" "select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',false); select command_status from public.calendar_oauth_claim_v1(decode(repeat('d1',32),'hex'),decode(repeat('d2',32),'hex'),decode(repeat('d6',32),'hex'));")"; then return 1; fi
  wait "$oauth_claim_permission_pid"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.permission_grants where id='ca440000-0000-4000-8000-000000000087'" >/dev/null
  if [[ "$oauth_claim_permission_status" != "OAUTH_FLOW_INVALID" ]] || [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select count(*) from public.calendar_oauth_transactions where id='ca440000-0000-4000-8000-000000000087'")" != "0" ]]; then printf 'Permission DENY allowed OAuth claim or retained PKCE material\n' >&2; return 1; fi
  printf 'GOOGLE_CALENDAR_OAUTH_CLAIM_PERMISSION_REVOKE_FIRST_OK\n'
  printf 'GOOGLE_CALENDAR_AUTHORIZATION_REVOKE_FIRST_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $candidate_race_setup$
declare result record;
begin
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000096',decode(repeat('91',32),'hex'),decode(repeat('92',32),'hex'),decode(repeat('93',32),'hex'),decode(repeat('94',32),'hex'),decode(repeat('95',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'candidate race OAuth start failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('91',32),'hex'),decode(repeat('92',32),'hex'),decode(repeat('96',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'candidate race OAuth claim failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000096',decode(repeat('96',32),'hex'),'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000023',3,decode(repeat('97',48),'hex'),decode(repeat('98',12),'hex'),1,decode(repeat('99',32),'hex'),7,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]);
  if result.command_status<>'CANDIDATE' then raise exception 'candidate race OAuth finalize failed: %',result.command_status; end if;
end
$candidate_race_setup$;
commit;
SQL
  local candidate_claim_assignment_writer="candidate_claim_assignment_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$candidate_claim_assignment_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date+1 where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
select pg_advisory_xact_lock(4242424250);
select pg_sleep(10);
commit;
SQL
  ) &
  local candidate_claim_assignment_pid="$!" candidate_claim_assignment_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424250)')" == "f" ]]; then candidate_claim_assignment_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$candidate_claim_assignment_ready" != "true" ]]; then wait "$candidate_claim_assignment_pid" || true; printf 'Candidate claim assignment revoke fixture did not become ready\n' >&2; return 1; fi
  local candidate_revoke_claim_status
  if ! candidate_revoke_claim_status="$(run_waiting_routine_status "$reconciler_url" "candidate_claim_assignment_wait" "$candidate_claim_assignment_writer" "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_candidate_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('9a',32),'hex'));")"; then return 1; fi
  wait "$candidate_claim_assignment_pid"
  if [[ "$candidate_revoke_claim_status" != "AUTHORIZATION_REQUIRED" ]]; then printf 'Revoked authorization allowed candidate claim: %s\n' "$candidate_revoke_claim_status" >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date,end_date=null where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
update public.calendar_connection_credentials set lifecycle='CANDIDATE',verification_claim_token_hash=null,verification_claim_expires_at=null,available_at=statement_timestamp(),row_version=row_version+1 where id='ca440000-0000-4000-8000-000000000023' and lifecycle='ACTION_REQUIRED';
SQL
  local candidate_claim_deny_writer="candidate_claim_deny_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$candidate_claim_deny_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select pg_advisory_xact_lock(pg_catalog.hashtextextended('10000000-0000-0000-0000-000000000001',0));
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
select 'ca440000-0000-4000-8000-000000000089','10000000-0000-0000-0000-000000000001',null,'USER',session_record.user_id,'CALENDAR_CONNECTION_MANAGE','DENY',statement_timestamp()-interval '1 minute',session_record.user_id,'Candidate claim revoke-first permission fence'
from public.auth_sessions session_record where session_record.company_id='10000000-0000-0000-0000-000000000001' and session_record.id='4f000000-0000-4000-8000-000000000001';
select pg_advisory_xact_lock(4242424251);
select pg_sleep(10);
commit;
SQL
  ) &
  local candidate_claim_permission_pid="$!" candidate_claim_permission_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424251)')" == "f" ]]; then candidate_claim_permission_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$candidate_claim_permission_ready" != "true" ]]; then wait "$candidate_claim_permission_pid" || true; printf 'Candidate claim permission revoke fixture did not become ready\n' >&2; return 1; fi
  local candidate_permission_claim_status
  if ! candidate_permission_claim_status="$(run_waiting_routine_status "$reconciler_url" "candidate_claim_deny_wait" "$candidate_claim_deny_writer" "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_candidate_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('9c',32),'hex'));")"; then return 1; fi
  wait "$candidate_claim_permission_pid"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
delete from public.permission_grants where id='ca440000-0000-4000-8000-000000000089';
update public.calendar_connection_credentials set lifecycle='CANDIDATE',verification_claim_token_hash=null,verification_claim_expires_at=null,available_at=statement_timestamp(),row_version=row_version+1 where id='ca440000-0000-4000-8000-000000000023' and lifecycle='ACTION_REQUIRED';
SQL
  if [[ "$candidate_permission_claim_status" != "AUTHORIZATION_REQUIRED" ]]; then printf 'Permission DENY allowed candidate claim: %s\n' "$candidate_permission_claim_status" >&2; return 1; fi
  printf 'GOOGLE_CALENDAR_CANDIDATE_CLAIM_REVOKE_FIRST_BARRIERS_OK\n'
  local candidate_claim_status
  candidate_claim_status="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" -c "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_candidate_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('9b',32),'hex'));" | tail -n 1)"
  if [[ "$candidate_claim_status" != "CLAIMED" ]]; then printf 'Candidate success-path claim failed: %s\n' "$candidate_claim_status" >&2; return 1; fi
  local candidate_row_version candidate_connection_version
  IFS='|' read -r candidate_row_version candidate_connection_version <<< "$(psql -XqAt -F '|' -v ON_ERROR_STOP=1 -d "$admin_url" -c "select credential.row_version,connection_record.version from public.calendar_connection_credentials credential join public.calendar_connections connection_record on connection_record.company_id=credential.company_id and connection_record.id=credential.connection_id where credential.id='ca440000-0000-4000-8000-000000000023'")"
  (
    psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" >/dev/null <<SQL
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
do \$candidate_finalize_lock\$
declare result record;
begin
  select * into result from public.calendar_candidate_finalize_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000023',decode(repeat('9b',32),'hex'),$candidate_row_version,$candidate_connection_version,'ACCESS_VERIFIED',null,null);
  if result.command_status<>'ACCESS_VERIFIED' then raise exception 'candidate success-path finalize failed: %',result.command_status; end if;
end
\$candidate_finalize_lock\$;
select pg_advisory_xact_lock(4242424247);
select pg_sleep(7);
rollback;
SQL
  ) &
  local candidate_finalize_pid="$!" candidate_finalize_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424247)')" == "f" ]]; then candidate_finalize_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$candidate_finalize_ready" != "true" ]]; then wait "$candidate_finalize_pid" || true; printf 'Candidate finalize lock fixture did not become ready\n' >&2; return 1; fi
  local candidate_lock_sql
  for candidate_lock_sql in \
    "update public.hotel_staff_assignments set end_date=(statement_timestamp() at time zone 'Asia/Seoul')::date-1 where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001'" \
    "update public.auth_sessions set revoked_at=statement_timestamp() where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001'" \
    "update public.users set status='INACTIVE' where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.companies set status='SUSPENDED' where id='10000000-0000-0000-0000-000000000001'" \
    "update public.branches set status='INACTIVE' where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.hotel_profiles set hotel_status='INACTIVE' where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.calendar_hotel_links set status='ACTION_REQUIRED' where company_id='10000000-0000-0000-0000-000000000001' and status<>'DISCONNECTED'" \
    "update public.permission_grants set valid_until=valid_until where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.user_role_memberships set valid_until=valid_until where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.roles set status=status where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.user_group_memberships set valid_until=valid_until where company_id='10000000-0000-0000-0000-000000000001'" \
    "update public.user_groups set status=status where company_id='10000000-0000-0000-0000-000000000001'"
  do
    if psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "set statement_timeout='400ms'; $candidate_lock_sql" >/dev/null 2>&1; then wait "$candidate_finalize_pid" || true; printf 'Authorization mutation was not blocked by candidate finalize\n' >&2; return 1; fi
  done
  wait "$candidate_finalize_pid"
  local candidate_finalize_assignment_writer="candidate_finalize_assignment_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$candidate_finalize_assignment_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date+1 where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001');
select pg_advisory_xact_lock(4242424252);
select pg_sleep(10);
commit;
SQL
  ) &
  local candidate_finalize_assignment_pid="$!" candidate_finalize_assignment_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424252)')" == "f" ]]; then candidate_finalize_assignment_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$candidate_finalize_assignment_ready" != "true" ]]; then wait "$candidate_finalize_assignment_pid" || true; printf 'Candidate finalize assignment revoke fixture did not become ready\n' >&2; return 1; fi
  local candidate_revoke_finalize_status
  if ! candidate_revoke_finalize_status="$(run_waiting_routine_status "$reconciler_url" "candidate_finalize_assignment_wait" "$candidate_finalize_assignment_writer" "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_candidate_finalize_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000023',decode(repeat('9b',32),'hex'),$candidate_row_version,$candidate_connection_version,'ACCESS_VERIFIED',null,null);")"; then return 1; fi
  wait "$candidate_finalize_assignment_pid"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date,end_date=null where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id=(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001')" >/dev/null
  if [[ "$candidate_revoke_finalize_status" != "ACTION_REQUIRED" ]] || [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select (lifecycle='ACTION_REQUIRED' and verification_claim_token_hash is null and verification_claim_expires_at is null)::text from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000023'")" != "true" ]]; then printf 'Assignment revoke allowed candidate finalize or left claim material\n' >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_connection_credentials set lifecycle='CANDIDATE',verification_claim_token_hash=null,verification_claim_expires_at=null,available_at=statement_timestamp(),row_version=row_version+1 where id='ca440000-0000-4000-8000-000000000023' and lifecycle='ACTION_REQUIRED'" >/dev/null
  local candidate_permission_finalize_claim_status
  candidate_permission_finalize_claim_status="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" -c "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_candidate_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('9d',32),'hex'));" | tail -n 1)"
  if [[ "$candidate_permission_finalize_claim_status" != "CLAIMED" ]]; then printf 'Candidate permission finalize setup claim failed: %s\n' "$candidate_permission_finalize_claim_status" >&2; return 1; fi
  local candidate_permission_row_version candidate_permission_connection_version
  IFS='|' read -r candidate_permission_row_version candidate_permission_connection_version <<< "$(psql -XqAt -F '|' -v ON_ERROR_STOP=1 -d "$admin_url" -c "select credential.row_version,connection_record.version from public.calendar_connection_credentials credential join public.calendar_connections connection_record on connection_record.company_id=credential.company_id and connection_record.id=credential.connection_id where credential.id='ca440000-0000-4000-8000-000000000023'")"
  local candidate_finalize_deny_writer="candidate_finalize_deny_writer_$$_${RANDOM}"
  (
    PGAPPNAME="$candidate_finalize_deny_writer" psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select pg_advisory_xact_lock(pg_catalog.hashtextextended('10000000-0000-0000-0000-000000000001',0));
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
select 'ca440000-0000-4000-8000-000000000088','10000000-0000-0000-0000-000000000001',null,'USER',session_record.user_id,'CALENDAR_CONNECTION_MANAGE','DENY',statement_timestamp()-interval '1 minute',session_record.user_id,'Candidate finalize revoke-first permission fence'
from public.auth_sessions session_record where session_record.company_id='10000000-0000-0000-0000-000000000001' and session_record.id='4f000000-0000-4000-8000-000000000001';
select pg_advisory_xact_lock(4242424253);
select pg_sleep(10);
commit;
SQL
  ) &
  local candidate_finalize_permission_pid="$!" candidate_finalize_permission_ready=false
  for _ in $(seq 1 50); do
    if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c 'select pg_try_advisory_lock(4242424253)')" == "f" ]]; then candidate_finalize_permission_ready=true; break; fi
    sleep 0.1
  done
  if [[ "$candidate_finalize_permission_ready" != "true" ]]; then wait "$candidate_finalize_permission_pid" || true; printf 'Candidate finalize permission revoke fixture did not become ready\n' >&2; return 1; fi
  local candidate_permission_finalize_status
  if ! candidate_permission_finalize_status="$(run_waiting_routine_status "$reconciler_url" "candidate_finalize_deny_wait" "$candidate_finalize_deny_writer" "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_candidate_finalize_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000023',decode(repeat('9d',32),'hex'),$candidate_permission_row_version,$candidate_permission_connection_version,'ACCESS_VERIFIED',null,null);")"; then return 1; fi
  wait "$candidate_finalize_permission_pid"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.permission_grants where id='ca440000-0000-4000-8000-000000000088'" >/dev/null
  if [[ "$candidate_permission_finalize_status" != "ACTION_REQUIRED" ]] || [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select (lifecycle='ACTION_REQUIRED' and verification_claim_token_hash is null and verification_claim_expires_at is null)::text from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000023'")" != "true" ]]; then printf 'Permission DENY allowed candidate finalize or left claim material\n' >&2; return 1; fi
  printf 'GOOGLE_CALENDAR_CANDIDATE_FINALIZE_REVOKE_FIRST_BARRIERS_OK\n'
  printf 'GOOGLE_CALENDAR_CANDIDATE_AUTHORIZATION_RACE_MATRIX_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $oauth_flow_cap$
declare result record; flow_number integer;
begin
  for flow_number in 1..5 loop
    select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),gen_random_uuid(),decode(lpad(to_hex(flow_number),64,'0'),'hex'),decode(repeat('bd',32),'hex'),decode(repeat('be',32),'hex'),decode(repeat('ce',32),'hex'),decode(repeat('df',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
    if result.command_status<>'CREATED' then raise exception 'OAuth active-flow fixture failed before cap: %',result.command_status; end if;
  end loop;
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),gen_random_uuid(),decode(repeat('ef',32),'hex'),decode(repeat('ad',32),'hex'),decode(repeat('ae',32),'hex'),decode(repeat('bc',32),'hex'),decode(repeat('de',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'OAUTH_RATE_LIMITED' then raise exception 'OAuth active-flow cap was not enforced: %',result.command_status; end if;
end
$oauth_flow_cap$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.calendar_oauth_transactions where company_id='10000000-0000-0000-0000-000000000001'" >/dev/null
  local oauth_concurrency_dir
  oauth_concurrency_dir="$(mktemp -d)"
  local oauth_pids=()
  for flow_number in 1 2 3 4 5 6; do
    (
      psql -XqAt -v ON_ERROR_STOP=1 -d "$api_probe_url" -c "select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',false); select command_status from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),gen_random_uuid(),decode(lpad(to_hex($((100 + flow_number))),64,'0'),'hex'),decode(lpad(to_hex($((200 + flow_number))),64,'0'),'hex'),decode(repeat('bd',32),'hex'),decode(repeat('ce',32),'hex'),decode(repeat('df',12),'hex'),1,'/admin/calendar',true,3,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));" >"$oauth_concurrency_dir/$flow_number"
    ) &
    oauth_pids+=("$!")
  done
  for oauth_pid in "${oauth_pids[@]}"; do wait "$oauth_pid"; done
  local concurrent_created concurrent_limited concurrent_active
  concurrent_created="$( { grep -h '^CREATED$' "$oauth_concurrency_dir"/* || true; } | wc -l )"
  concurrent_limited="$( { grep -h '^OAUTH_RATE_LIMITED$' "$oauth_concurrency_dir"/* || true; } | wc -l )"
  concurrent_active="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select count(*) from public.calendar_oauth_transactions where company_id='10000000-0000-0000-0000-000000000001' and status in ('PENDING','CLAIMED')")"
  rm -rf "$oauth_concurrency_dir"
  if (( concurrent_created > 5 || concurrent_limited < 1 || concurrent_active > 5 )); then
    printf 'OAuth concurrent cap failed: created=%s limited=%s active=%s\n' "$concurrent_created" "$concurrent_limited" "$concurrent_active" >&2
    return 1
  fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.calendar_oauth_transactions where company_id='10000000-0000-0000-0000-000000000001'" >/dev/null
  printf '%s\n' 'GOOGLE_CALENDAR_OAUTH_CONCURRENT_CAP_OK'
  printf '%s\n' 'GOOGLE_CALENDAR_CANDIDATE_ACTUAL_DB_OK'
  local second_preflight_visit_id second_preflight_job_id second_preflight_first second_preflight_second
  second_preflight_visit_id="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select id from public.hotel_repair_visits where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' order by id limit 1")"
  if [[ ! "$second_preflight_visit_id" =~ ^[0-9a-f-]{36}$ ]]; then printf 'Second preflight visit fixture missing\n' >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_projection_jobs set available_at=statement_timestamp()+interval '1 hour' where status in ('PENDING','FAILED')" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.hotel_repair_visits set starts_at=starts_at+interval '1 minute',ends_at=ends_at+interval '1 minute',version=version+1 where id='$second_preflight_visit_id'::uuid" >/dev/null
  second_preflight_job_id="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select job.id from public.calendar_projection_jobs job join public.calendar_event_links event_record on event_record.id=job.event_link_id where event_record.visit_id='$second_preflight_visit_id'::uuid and job.status='PENDING' order by job.created_at desc limit 1")"
  if [[ ! "$second_preflight_job_id" =~ ^[0-9a-f-]{36}$ ]]; then printf 'Second preflight job fixture missing\n' >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
select * from public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('91',32),'hex'),1);
commit;
SQL
  second_preflight_first="$( { psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" -c "begin; select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true); select command_status from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001','$second_preflight_job_id'::uuid,decode(repeat('91',32),'hex'),'PREFLIGHT','NO_OP',null,null,null,null,null,null); rollback;" | grep -E '^(READY|STALE_VERSION)$' | tail -n 1; } || true )"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.hotel_repair_visits set starts_at=starts_at+interval '1 minute',ends_at=ends_at+interval '1 minute',version=version+1 where id='$second_preflight_visit_id'::uuid" >/dev/null
  second_preflight_second="$( { psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" -c "begin; select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true); select command_status from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001','$second_preflight_job_id'::uuid,decode(repeat('91',32),'hex'),'PREFLIGHT','NO_OP',null,null,null,null,null,null); commit;" | grep -E '^(READY|STALE_VERSION)$' | tail -n 1; } || true )"
  if [[ "$second_preflight_first" != "READY" || "$second_preflight_second" != "STALE_VERSION" ]]; then printf 'Second preflight status mismatch first=%s second=%s\n' "$second_preflight_first" "$second_preflight_second" >&2; return 1; fi
  if [[ "$(psql -XqAt -v ON_ERROR_STOP=1 -d "$admin_url" -c "select ((select status from public.calendar_projection_jobs where id='$second_preflight_job_id'::uuid)='SUPERSEDED' and (select count(*) from public.calendar_projection_attempts where job_id='$second_preflight_job_id'::uuid)=0 and (select count(*) from public.calendar_projection_jobs job join public.calendar_event_links event_record on event_record.id=job.event_link_id where event_record.visit_id='$second_preflight_visit_id'::uuid and job.status='PENDING')=1)::text")" != "true" ]]; then printf 'Second preflight did not preserve provider mutation zero and fresh job identity\n' >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_projection_jobs set available_at=statement_timestamp() where status in ('PENDING','FAILED')" >/dev/null
  printf 'GOOGLE_CALENDAR_SECOND_PREFLIGHT_ACTUAL_DB_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $projection_assertions$
declare visit_id_value uuid;
begin
  if (select count(*) from public.calendar_connection_credentials where company_id='10000000-0000-0000-0000-000000000001' and lifecycle='ACTIVE' and octet_length(refresh_credential_ciphertext)>0 and octet_length(refresh_credential_iv)=12)<>1 then raise exception 'encrypted credential storage mismatch'; end if;
  if (select count(*) from public.calendar_hotel_links where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and status='ACTIVE' and calendar_id_ciphertext is not null)<>1 then raise exception 'hotel link finalize mismatch'; end if;
  select id into visit_id_value from public.hotel_repair_visits where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' order by id limit 1;
  if visit_id_value is null then raise exception 'repair visit fixture missing'; end if;
  update public.hotel_repair_visits set starts_at=starts_at+interval '20 years',ends_at=ends_at+interval '20 years',version=version+1 where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and id=visit_id_value;
  if not exists(select 1 from public.calendar_event_links where company_id='10000000-0000-0000-0000-000000000001' and visit_id=visit_id_value and desired_source_version=(select version from public.hotel_repair_visits where id=visit_id_value)) then raise exception 'visit trigger did not create or advance event link'; end if;
  if not exists(select 1 from public.calendar_event_links where company_id='10000000-0000-0000-0000-000000000001' and visit_id=visit_id_value and stable_event_id ~ '^ca[0-9a-f]{40}$' and stable_event_id not like '%'||replace(visit_id_value::text,'-','')||'%') then raise exception 'provider event identity leaked or malformed'; end if;
  if not exists(select 1 from public.calendar_projection_jobs job join public.calendar_event_links link on link.id=job.event_link_id where job.company_id='10000000-0000-0000-0000-000000000001' and link.visit_id=visit_id_value and job.status in ('PENDING','PROCESSING')) then raise exception 'visit trigger did not create aggregate head job'; end if;
  update public.calendar_projection_jobs set status='DEAD_LETTER',attempt_count=8,last_error_code='PROVIDER_ACTION_REQUIRED',completed_at=statement_timestamp() where id=(select job.id from public.calendar_projection_jobs job join public.calendar_event_links link on link.id=job.event_link_id where job.company_id='10000000-0000-0000-0000-000000000001' and link.visit_id=visit_id_value and job.status='PENDING' order by job.created_at limit 1);
  update public.calendar_event_links set status='ACTION_REQUIRED' where company_id='10000000-0000-0000-0000-000000000001' and visit_id=visit_id_value;
  if not exists(select 1 from public.calendar_event_links where company_id='10000000-0000-0000-0000-000000000001' and visit_id=visit_id_value and marker_key_version=1) then raise exception 'existing event marker key version was rewritten during rotation'; end if;
end
$projection_assertions$;
SQL
  IFS='|' read -r canonical_visit_id canonical_repair_id canonical_from canonical_to <<<"$(psql -XqAt -F '|' -v ON_ERROR_STOP=1 -d "$admin_url" -c "select event_link.visit_id,visit.repair_case_id,(visit.starts_at at time zone 'Asia/Seoul')::date,((visit.starts_at at time zone 'Asia/Seoul')::date+1) from public.calendar_event_links event_link join public.hotel_repair_visits visit on visit.company_id=event_link.company_id and visit.branch_id=event_link.branch_id and visit.id=event_link.visit_id where event_link.company_id='10000000-0000-0000-0000-000000000001' and event_link.status='ACTION_REQUIRED' order by event_link.updated_at desc limit 1")"
  if [[ ! "$canonical_visit_id" =~ ^[0-9a-f-]{36}$ || ! "$canonical_repair_id" =~ ^[0-9a-f-]{36}$ || ! "$canonical_from" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ || ! "$canonical_to" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then printf 'canonical read-back fixture values missing or malformed\n' >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -v visit_id="$canonical_visit_id" >/dev/null <<'SQL'
select set_config('app.test_calendar_visit_id',:'visit_id',false);
do $canonical_helper_assertion$
declare computed_status text; link_states jsonb;
begin
  select public.calendar_visit_projection_status_v1(visit.company_id,visit.branch_id,visit.id) into computed_status from public.hotel_repair_visits visit where visit.id=current_setting('app.test_calendar_visit_id')::uuid;
  select jsonb_agg(jsonb_build_object('hotelLinkStatus',hotel_link.status,'eventLinkStatus',event_link.status,'hotelLinkId',hotel_link.id,'eventHotelLinkId',event_link.hotel_link_id)) into link_states from public.calendar_event_links event_link join public.calendar_hotel_links hotel_link on hotel_link.id=event_link.hotel_link_id where event_link.visit_id=current_setting('app.test_calendar_visit_id')::uuid;
  if computed_status<>'ACTION_REQUIRED' then raise exception 'canonical helper ACTION_REQUIRED mismatch computed=% links=%',computed_status,link_states; end if;
end
$canonical_helper_assertion$;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" -v visit_id="$canonical_visit_id" -v repair_id="$canonical_repair_id" -v calendar_from="$canonical_from" -v calendar_to="$canonical_to" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
select set_config('app.test_calendar_visit_id',:'visit_id',true),set_config('app.test_calendar_repair_id',:'repair_id',true),set_config('app.test_calendar_from',:'calendar_from',true),set_config('app.test_calendar_to',:'calendar_to',true);
do $canonical_action_required$
declare result record; target_projection_status text; calendar_projection_status text;
begin
  select * into result from public.hotel_repair_read_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',current_setting('app.test_calendar_repair_id')::uuid,'{}'::jsonb,repeat('I',43));
  select visit->>'calendarProjectionStatus' into target_projection_status from jsonb_array_elements(result.result_snapshot->'visits') visit where visit->>'id'=current_setting('app.test_calendar_visit_id');
  if result.command_status<>'OK' or target_projection_status<>'ACTION_REQUIRED' then raise exception 'repair visit canonical ACTION_REQUIRED read-back mismatch id=% status=% command=%',current_setting('app.test_calendar_visit_id'),target_projection_status,result.command_status; end if;
  if result.result_snapshot->>'calendarProjectionStatus'<>'ACTION_REQUIRED' then raise exception 'repair aggregate canonical ACTION_REQUIRED read-back mismatch: %',result.result_snapshot->>'calendarProjectionStatus'; end if;
  select * into result from public.hotel_calendar_events_read_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',jsonb_build_object('from',current_setting('app.test_calendar_from'),'to',current_setting('app.test_calendar_to'),'pageSize',200),repeat('I',43));
  select event->>'calendarProjectionStatus' into calendar_projection_status from jsonb_array_elements(result.result_snapshot->'events') event where event->>'id'=current_setting('app.test_calendar_visit_id');
  if result.command_status<>'OK' or calendar_projection_status<>'ACTION_REQUIRED' then raise exception 'calendar canonical ACTION_REQUIRED read-back mismatch id=% projection=% command=%',current_setting('app.test_calendar_visit_id'),calendar_projection_status,result.command_status; end if;
end
$canonical_action_required$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -v visit_id="$canonical_visit_id" >/dev/null <<'SQL'
insert into public.calendar_projection_jobs(
  id,company_id,branch_id,aggregate_type,hotel_link_id,status,
  attempted_connection_version,attempt_count,last_error_code,completed_at
)
select
  'ca440000-0000-4000-8000-000000000090',link.company_id,link.branch_id,
  'HOTEL_CALENDAR',link.id,'DEAD_LETTER',link.connection_version,8,
  'UNRELATED_HOTEL_FAILURE',statement_timestamp()
from public.calendar_hotel_links link
where link.company_id='10000000-0000-0000-0000-000000000001'
  and link.branch_id='50000000-0000-4000-8000-000000000001';
insert into public.calendar_sync_failures(
  id,company_id,branch_id,job_id,hotel_link_id,failure_code
)
select
  'ca440000-0000-4000-8000-000000000091',job.company_id,job.branch_id,
  job.id,job.hotel_link_id,'UNRELATED_HOTEL_FAILURE'
from public.calendar_projection_jobs job
where job.id='ca440000-0000-4000-8000-000000000090';
update public.calendar_sync_failures failure
set status='RESOLVED',resolved_at=statement_timestamp(),version=version+1
where failure.status='OPEN'
  and failure.event_link_id=(
    select event_link.id
    from public.calendar_event_links event_link
    where event_link.visit_id=:'visit_id'::uuid
  );
insert into public.calendar_projection_jobs(
  id,company_id,branch_id,aggregate_type,event_link_id,status,
  attempted_source_version,attempted_starts_at,attempted_ends_at,attempted_visit_status,
  attempted_connection_version,attempted_hotel_link_generation,attempted_hotel_link_version,
  attempted_event_link_version,attempted_credential_id,attempted_credential_version,
  create_dispatch_state,attempt_count,last_error_code,completed_at
)
select
  'ca440000-0000-4000-8000-000000000092',event_link.company_id,
  event_link.branch_id,'VISIT_EVENT',event_link.id,'DEAD_LETTER',
  event_link.desired_source_version,visit_record.starts_at,visit_record.ends_at,visit_record.status,
  connection_record.version,hotel_link.generation,hotel_link.version,event_link.version,
  credential_record.id,credential_record.credential_version,'CREATE_DISPATCHED_OUTCOME_UNKNOWN',8,
  'EXACT_EVENT_FAILURE_A',statement_timestamp()
from public.calendar_event_links event_link
join public.hotel_repair_visits visit_record on visit_record.company_id=event_link.company_id and visit_record.id=event_link.visit_id
join public.calendar_hotel_links hotel_link
  on hotel_link.company_id=event_link.company_id
 and hotel_link.branch_id=event_link.branch_id
 and hotel_link.id=event_link.hotel_link_id
join public.calendar_connections connection_record on connection_record.company_id=hotel_link.company_id and connection_record.id=hotel_link.connection_id
join public.calendar_connection_credentials credential_record on credential_record.company_id=connection_record.company_id and credential_record.id=connection_record.active_credential_id
where event_link.visit_id=:'visit_id'::uuid;
insert into public.calendar_sync_failures(
  id,company_id,branch_id,job_id,event_link_id,failure_code
)
select
  'ca440000-0000-4000-8000-000000000093',job.company_id,job.branch_id,
  job.id,job.event_link_id,'EXACT_EVENT_FAILURE_A'
from public.calendar_projection_jobs job
where job.id='ca440000-0000-4000-8000-000000000092';
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
values('ca440000-0000-4000-8000-000000000095','10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001','USER','2f000000-0000-4000-8000-000000000001','CALENDAR_PROJECTION_RETRY','ALLOW',statement_timestamp()-interval '1 minute','2f000000-0000-4000-8000-000000000001','재시도 전용 권한 통합검증');
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $reason_bounds$
declare result record;
begin
  select * into result from public.calendar_projection_failure_retry_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000093',1,'R',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/failure-retry',md5(gen_random_uuid()::text));
  if result.command_status<>'VALIDATION_ERROR' then raise exception 'one-character retry reason was accepted: %',result.command_status; end if;
  select * into result from public.calendar_projection_failure_retry_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000093',1,repeat('R',501),gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/failure-retry',md5(gen_random_uuid()::text));
  if result.command_status<>'VALIDATION_ERROR' then raise exception '501-character retry reason was accepted: %',result.command_status; end if;
end
$reason_bounds$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
values('ca440000-0000-4000-8000-000000000094','10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001','USER','2f000000-0000-4000-8000-000000000001','CALENDAR_PROJECTION_RETRY','DENY',statement_timestamp()-interval '1 minute','2f000000-0000-4000-8000-000000000001','권한 회수 차단 검증');
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $permission_revoked$
declare result record;
begin
  select * into result from public.calendar_projection_failure_retry_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000093',1,'권한 회수 차단',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/failure-retry',md5(gen_random_uuid()::text));
  if result.command_status<>'FORBIDDEN' then raise exception 'revoked retry permission was accepted: %',result.command_status; end if;
end
$permission_revoked$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
delete from public.permission_grants where id='ca440000-0000-4000-8000-000000000094';
update public.auth_sessions set auth_time=statement_timestamp()-interval '16 minutes' where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001';
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $stale_reauthentication$
declare result record;
begin
  select * into result from public.calendar_projection_failure_retry_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000093',1,'재인증 만료 차단',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/failure-retry',md5(gen_random_uuid()::text));
  if result.command_status<>'FORBIDDEN' then raise exception 'stale reauthentication was accepted: %',result.command_status; end if;
end
$stale_reauthentication$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.auth_sessions set auth_time=statement_timestamp() where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001';
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date-1,end_date=(statement_timestamp() at time zone 'Asia/Seoul')::date-1 where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id='2f000000-0000-4000-8000-000000000001' and terminated_at is null;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $expired_assignment_retry$
declare result record;
begin
  select * into result from public.calendar_projection_failure_retry_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000093',1,'종료배정 재시도 차단',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/failure-retry',md5(gen_random_uuid()::text));
  if result.command_status<>'FORBIDDEN' then raise exception 'expired hotel assignment allowed exact retry: %',result.command_status; end if;
end
$expired_assignment_retry$;
rollback;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_staff_assignments set start_date=(statement_timestamp() at time zone 'Asia/Seoul')::date,end_date=null where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and user_id='2f000000-0000-4000-8000-000000000001' and terminated_at is null;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $manual_retry$
declare result record; failure_id uuid; failure_version integer;
begin
  select * into result from public.calendar_connection_status_read_v1('10000000-0000-0000-0000-000000000001',repeat('I',43));
  select (failure->>'failureId')::uuid,(failure->>'version')::integer
    into strict failure_id,failure_version
    from jsonb_array_elements(result.result_snapshot->'failures') failure
   where failure->>'failureId'='ca440000-0000-4000-8000-000000000093';
  select * into result from public.calendar_projection_failure_retry_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',repeat('I',43),failure_id,failure_version,repeat('R',500),gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/failure-retry',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' then raise exception 'manual retry failed: %',result.command_status; end if;
end
$manual_retry$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -v visit_id="$canonical_visit_id" >/dev/null <<'SQL'
select set_config('app.test_calendar_visit_id',:'visit_id',false);
do $manual_retry_assertions$
begin
  if not exists(
    select 1 from public.calendar_projection_jobs terminal_job
    join public.calendar_projection_jobs retry_job on retry_job.event_link_id=terminal_job.event_link_id and retry_job.status='PENDING'
    where terminal_job.id='ca440000-0000-4000-8000-000000000092'
      and row(retry_job.attempted_source_version,retry_job.attempted_starts_at,retry_job.attempted_ends_at,retry_job.attempted_visit_status,retry_job.attempted_connection_version,retry_job.attempted_hotel_link_generation,retry_job.attempted_hotel_link_version,retry_job.attempted_credential_id,retry_job.attempted_credential_version,retry_job.create_dispatch_state)
          is not distinct from
          row(terminal_job.attempted_source_version,terminal_job.attempted_starts_at,terminal_job.attempted_ends_at,terminal_job.attempted_visit_status,terminal_job.attempted_connection_version,terminal_job.attempted_hotel_link_generation,terminal_job.attempted_hotel_link_version,terminal_job.attempted_credential_id,terminal_job.attempted_credential_version,terminal_job.create_dispatch_state)
      and retry_job.attempted_event_link_version=terminal_job.attempted_event_link_version+1
      and retry_job.attempted_event_link_version=(select event_link.version from public.calendar_event_links event_link where event_link.id=retry_job.event_link_id)
  ) then raise exception 'manual retry did not preserve immutable attempted payload with the current successor event fence'; end if;
  if not exists(select 1 from public.calendar_projection_jobs where status='DEAD_LETTER' and attempt_count=8) then raise exception 'manual retry rewrote dead-letter attempt history'; end if;
  if not exists(select 1 from public.calendar_projection_jobs where status='PENDING' and attempt_count=0 and event_link_id is not null) then raise exception 'manual retry did not create a fresh head'; end if;
  if not exists(select 1 from public.calendar_sync_failures where id='ca440000-0000-4000-8000-000000000091' and status='OPEN' and version=1) then raise exception 'exact retry mutated unrelated failure B'; end if;
  if not exists(select 1 from public.calendar_projection_jobs where id='ca440000-0000-4000-8000-000000000090' and status='DEAD_LETTER' and attempt_count=8) then raise exception 'exact retry rewrote unrelated terminal evidence B'; end if;
  if exists(select 1 from public.calendar_projection_jobs where hotel_link_id=(select hotel_link_id from public.calendar_sync_failures where id='ca440000-0000-4000-8000-000000000091') and status='PENDING') then raise exception 'exact retry created unrelated hotel retry head B'; end if;
  if not exists(select 1 from public.audit_events where company_id='10000000-0000-0000-0000-000000000001' and event_code='CALENDAR_PROJECTION_FAILURE_RETRY_REQUESTED' and reason=repeat('R',500) and session_id='4f000000-0000-4000-8000-000000000001' and result='SUCCEEDED') then raise exception 'exact retry audit reason was not preserved'; end if;
  update public.calendar_projection_jobs retry_job set create_dispatch_state='CREATE_NOT_ATTEMPTED',updated_at=statement_timestamp()
   where retry_job.status='PENDING' and retry_job.event_link_id=(select terminal_job.event_link_id from public.calendar_projection_jobs terminal_job where terminal_job.id='ca440000-0000-4000-8000-000000000092');
  update public.calendar_projection_jobs job set status='SUPERSEDED',completed_at=statement_timestamp(),updated_at=statement_timestamp()
   where job.status='PENDING' and job.event_link_id is not null and job.event_link_id<>(select event_link.id from public.calendar_event_links event_link where event_link.visit_id=current_setting('app.test_calendar_visit_id')::uuid and event_link.status='PENDING' order by event_link.updated_at desc limit 1);
end
$manual_retry_assertions$;
SQL
  printf '%s\n' 'GOOGLE_CALENDAR_UNCERTAIN_RETRY_FENCES_OK'
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$reconciler_url" pnpm exec tsx <<'NODE'
import { createPostgresCalendarProjectionRepository } from "./packages/db/src/index.ts";
import { reconcileGoogleCalendarCompany } from "./apps/api/src/calendar-projections/reconciler.ts";
const databaseUrl=process.env.TEST_READY_URL;
if(!databaseUrl)throw new Error("TEST_READY_URL missing");
const repository=createPostgresCalendarProjectionRepository(databaseUrl);
const crypto={
  decrypt:async(_value,aad)=>aad.startsWith("credential|")?"refresh":aad.startsWith("calendar_lookup_key|")?"lookup":"provider-calendar",
  encrypt:async()=>({ciphertext:new Uint8Array([1]),iv:new Uint8Array(12),keyVersion:1}),
  fingerprint:async(_value,domain,keyVersion)=>{
    if(domain==="provider-event-marker"&&keyVersion!==1)throw new Error(`retained marker key version lost: ${keyVersion}`);
    return new Uint8Array(32);
  },
};
const google={
  refresh:async()=>({accessToken:"memory",expiresIn:3600,scopes:[]}),
  createEvent:async(_access,_calendar,event)=>({id:event.id,extendedProperties:{private:{werehereLink:event.linkKey}}}),
  updateEvent:async(_access,_calendar,event)=>({id:event.id,extendedProperties:{private:{werehereLink:event.linkKey}}}),
  deleteEvent:async()=>undefined,
  getEvent:async()=>{throw new Error("unexpected read-back");},
};
try {
  const result=await reconcileGoogleCalendarCompany({repository,crypto,google,companyId:"10000000-0000-0000-0000-000000000001",limit:10,jitter:()=>0});
  if(result.claimed<1)throw new Error("actual claim returned no jobs");
  console.log("GOOGLE_CALENDAR_RECONCILER_ACTUAL_CLAIM_OK");
} finally {await repository.close();}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" -v visit_id="$canonical_visit_id" -v repair_id="$canonical_repair_id" -v calendar_from="$canonical_from" -v calendar_to="$canonical_to" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
select set_config('app.test_calendar_visit_id',:'visit_id',true),set_config('app.test_calendar_repair_id',:'repair_id',true),set_config('app.test_calendar_from',:'calendar_from',true),set_config('app.test_calendar_to',:'calendar_to',true);
do $canonical_synced$
declare result record;
begin
  select * into result from public.hotel_repair_read_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',current_setting('app.test_calendar_repair_id')::uuid,'{}'::jsonb,repeat('I',43));
  if result.command_status<>'OK' or not exists(select 1 from jsonb_array_elements(result.result_snapshot->'visits') visit where visit->>'id'=current_setting('app.test_calendar_visit_id') and visit->>'calendarProjectionStatus'='ACTION_REQUIRED') then raise exception 'repair visit did not preserve unrelated failure B: %',result.result_snapshot; end if;
  if result.result_snapshot->>'calendarProjectionStatus'<>'ACTION_REQUIRED' then raise exception 'repair aggregate falsely converged despite failure B: %',result.result_snapshot->>'calendarProjectionStatus'; end if;
  select * into result from public.hotel_calendar_events_read_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',jsonb_build_object('from',current_setting('app.test_calendar_from'),'to',current_setting('app.test_calendar_to'),'pageSize',200),repeat('I',43));
  if result.command_status<>'OK' or not exists(select 1 from jsonb_array_elements(result.result_snapshot->'events') event where event->>'id'=current_setting('app.test_calendar_visit_id') and event->>'calendarProjectionStatus'='ACTION_REQUIRED') then raise exception 'calendar falsely converged despite failure B status=% payload=%',result.command_status,result.result_snapshot; end if;
end
$canonical_synced$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -v visit_id="$canonical_visit_id" >/dev/null <<'SQL'
select set_config('app.test_calendar_visit_id',:'visit_id',false);
do $exact_failure_readback$
begin
  if not exists(
    select 1 from public.calendar_event_links
    where visit_id=current_setting('app.test_calendar_visit_id')::uuid
      and status='SYNCED'
  ) then raise exception 'exact failure A target did not sync'; end if;
  if not exists(
    select 1 from public.calendar_sync_failures
    where id='ca440000-0000-4000-8000-000000000093'
      and status='RESOLVED' and version=3
  ) then raise exception 'exact failure A was not resolved after retry success'; end if;
  if not exists(
    select 1 from public.calendar_sync_failures
    where id='ca440000-0000-4000-8000-000000000091'
      and status='OPEN' and version=1
  ) then raise exception 'unrelated failure B was falsely resolved'; end if;
  update public.calendar_sync_failures
     set status='RESOLVED',resolved_at=statement_timestamp(),version=version+1
   where id='ca440000-0000-4000-8000-000000000091';
end
$exact_failure_readback$;
SQL
  printf '%s\n' 'GOOGLE_CALENDAR_EXACT_FAILURE_RETRY_READ_BACK_OK'
  (
    cd "$ROOT_DIR"
    TEST_ADMIN_URL="$admin_url" TEST_READY_URL="$reconciler_url" pnpm exec tsx <<'NODE'
import { createRequire } from "node:module";
import { createPostgresCalendarProjectionRepository } from "./packages/db/src/index.ts";
import { reconcileGoogleCalendarCompany } from "./apps/api/src/calendar-projections/reconciler.ts";
import { GoogleCalendarProviderError } from "./apps/api/src/calendar-projections/google.ts";
const requireFromDb=createRequire(new URL("./packages/db/package.json",import.meta.url));
const postgres=requireFromDb("postgres");
const companyId="10000000-0000-0000-0000-000000000001";
const adminUrl=process.env.TEST_ADMIN_URL;
const readyUrl=process.env.TEST_READY_URL;
if(!adminUrl||!readyUrl)throw new Error("reverse completion fixture URLs missing");
const admin=postgres(adminUrl,{max:1,prepare:false});
const repositoryA=createPostgresCalendarProjectionRepository(readyUrl);
const repositoryB=createPostgresCalendarProjectionRepository(readyUrl);
const zeroLinkKey=Buffer.alloc(32).toString("base64url");
const crypto={
  decrypt:async(_value,aad)=>aad.startsWith("credential|")?"refresh":aad.startsWith("calendar_lookup_key|")?"lookup":"provider-calendar",
  encrypt:async()=>({ciphertext:new Uint8Array([1]),iv:new Uint8Array(12),keyVersion:1}),
  fingerprint:async()=>new Uint8Array(32),
};
let provider={etag:'"provider-v1"',event:null};
let updateCallCount=0;
let enterA;
const aAtProvider=new Promise(resolve=>{enterA=resolve;});
let releaseA;
const allowA=new Promise(resolve=>{releaseA=resolve;});
let bCanonical=null;
const google={
  refresh:async()=>({accessToken:"memory",expiresIn:3600,scopes:[]}),
  getEvent:async(_access,_calendar,eventId)=>provider.event??({id:eventId,etag:provider.etag,status:"confirmed",extendedProperties:{private:{werehereLink:zeroLinkKey}}}),
  updateEvent:async(_access,_calendar,event)=>{
    updateCallCount+=1;
    if(updateCallCount===1){
      enterA();
      await allowA;
    }
    if(event.etag!==provider.etag)throw GoogleCalendarProviderError.forStatus(412);
    const stored={...structuredClone(event),etag:'"provider-v2"',status:"confirmed",extendedProperties:{private:{werehereLink:event.linkKey}}};
    if(updateCallCount===2)bCanonical=structuredClone(stored);
    provider={etag:'"provider-v2"',event:stored};
    return provider.event;
  },
  createEvent:async(_access,_calendar,event)=>{
    if(provider.event)throw GoogleCalendarProviderError.forStatus(409);
    provider={etag:'"provider-v2"',event:{...structuredClone(event),etag:'"provider-v2"',status:"confirmed",extendedProperties:{private:{werehereLink:event.linkKey}}}};
    return provider.event;
  },
  deleteEvent:async()=>{throw new Error("reverse completion unexpectedly deleted provider event");},
};
try{
  await admin`update public.hotel_repair_visits set version=version+1 where id=(select visit_id from public.calendar_event_links where company_id=${companyId}::uuid order by updated_at desc limit 1)`;
  const runA=reconcileGoogleCalendarCompany({repository:repositoryA,crypto,google,companyId,limit:1,jitter:()=>0});
  await aAtProvider;
  await admin.begin(async tx=>{
    await tx`update public.hotel_repair_visits set version=version+1 where id=(select visit_id from public.calendar_event_links where company_id=${companyId}::uuid order by updated_at desc limit 1)`;
    await tx`update public.calendar_projection_jobs set claim_expires_at=statement_timestamp()-interval '1 second' where company_id=${companyId}::uuid and status='PROCESSING' and event_link_id is not null`;
  });
  const resultB=await reconcileGoogleCalendarCompany({repository:repositoryB,crypto,google,companyId,limit:1,jitter:()=>0});
  if(resultB.claimed!==1||!bCanonical)throw new Error("worker B did not reclaim and complete the latest provider event");
  releaseA();
  const resultA=await runA;
  if(resultA.claimed!==1)throw new Error("worker A did not complete its late path");
  await reconcileGoogleCalendarCompany({repository:repositoryB,crypto,google,companyId,limit:1,jitter:()=>0});
  const [state]=await admin`
    select event_link.id as event_link_id,event_link.status as event_link_status,
           event_link.desired_source_version,event_link.applied_source_version,event_link.applied_exists,
           public.calendar_visit_projection_status_v1(event_link.company_id,event_link.branch_id,event_link.visit_id) as projection_status,
           (select coalesce(jsonb_agg(jsonb_build_object('status',failure.status,'code',failure.failure_code) order by failure.occurred_at),'[]'::jsonb)
              from public.calendar_sync_failures failure
             where failure.event_link_id=event_link.id and failure.status='OPEN') as open_failures,
           (select coalesce(jsonb_agg(jsonb_build_object('id',job.id,'status',job.status,'attempt',job.attempt_count) order by job.updated_at),'[]'::jsonb)
              from public.calendar_projection_jobs job where job.event_link_id=event_link.id) as job_states,
           not exists(
             select 1 from public.calendar_projection_jobs active_job
             where active_job.event_link_id=event_link.id
               and active_job.status in ('PENDING','PROCESSING','FAILED')
           ) as no_active_jobs
    from public.calendar_event_links event_link
    where event_link.company_id=${companyId}::uuid
    order by event_link.updated_at desc limit 1
  `;
  if(!provider.event||JSON.stringify({...provider.event,etag:undefined})!==JSON.stringify({...bCanonical,etag:undefined}))
    throw new Error("late worker A overwrote worker B canonical provider event");
  if(!state||state.applied_exists!==true||state.applied_source_version!==state.desired_source_version||state.event_link_status!=="SYNCED"||state.projection_status!=="SYNCED"||state.open_failures.length!==0||state.no_active_jobs!==true)
    throw new Error(`reverse completion did not converge DB canonical state: ${JSON.stringify(state)}`);
  console.log("GOOGLE_CALENDAR_PROVIDER_REVERSE_COMPLETION_OK");
}finally{
  releaseA?.();
  await Promise.allSettled([repositoryA.close(),repositoryB.close(),admin.end({timeout:1})]);
}
NODE
  )
  local evidence_job_id evidence_event_link_id evidence_visit_id evidence_source_version evidence_created_at evidence_status
  IFS='|' read -r evidence_job_id evidence_event_link_id evidence_visit_id evidence_source_version evidence_created_at <<< "$(psql -XqAt -F '|' -v ON_ERROR_STOP=1 -d "$admin_url" -c "select job.id,event_record.id,event_record.visit_id,event_record.desired_source_version,job.created_at from public.calendar_projection_jobs job join public.calendar_event_links event_record on event_record.id=job.event_link_id where job.company_id='10000000-0000-0000-0000-000000000001' and job.status='SUCCEEDED' and event_record.status='SYNCED' order by job.completed_at desc limit 1")"
  if [[ ! "$evidence_job_id" =~ ^[0-9a-f-]{36}$ ]] || [[ ! "$evidence_event_link_id" =~ ^[0-9a-f-]{36}$ ]] || [[ ! "$evidence_visit_id" =~ ^[0-9a-f-]{36}$ ]] || [[ ! "$evidence_source_version" =~ ^[0-9]+$ ]]; then printf 'Exact evidence fixture identity missing\n' >&2; return 1; fi
  evidence_status="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" -c "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_projection_evidence_read_v1('10000000-0000-0000-0000-000000000001','EVENT_FINAL',null,'$evidence_visit_id'::uuid,$evidence_source_version,null,'$evidence_created_at'::timestamptz-interval '1 second');" | tail -n 1)"
  if [[ "$evidence_status" != "OK" ]]; then printf 'Exact evidence baseline was not ready: %s\n' "$evidence_status" >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_event_links set version=version+1 where id='$evidence_event_link_id'::uuid" >/dev/null
  evidence_status="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" -c "select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',false); select command_status from public.calendar_projection_evidence_read_v1('10000000-0000-0000-0000-000000000001','EVENT_FINAL',null,'$evidence_visit_id'::uuid,$evidence_source_version,null,'$evidence_created_at'::timestamptz-interval '1 second');" | tail -n 1)"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.calendar_event_links set version=version-1 where id='$evidence_event_link_id'::uuid" >/dev/null
  if [[ "$evidence_status" != "EVIDENCE_NOT_READY" ]]; then printf 'Advanced event-link version produced false-green evidence: %s\n' "$evidence_status" >&2; return 1; fi
  printf 'GOOGLE_CALENDAR_EXACT_EVIDENCE_VERSION_FENCE_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_repair_visits set version=version+1 where id=(select visit_id from public.calendar_event_links where company_id='10000000-0000-0000-0000-000000000001' order by updated_at desc limit 1);
SQL
  (
    cd "$ROOT_DIR/packages/db"
    TEST_READY_URL="$reconciler_url" TEST_ADMIN_URL="$admin_url" pnpm exec tsx <<'NODE'
import { createPostgresCalendarProjectionRepository } from "./src/index.ts";
import { reconcileGoogleCalendarCompany } from "../../apps/api/src/calendar-projections/reconciler.ts";
import { GoogleCalendarProviderError } from "../../apps/api/src/calendar-projections/google.ts";
import postgres from "postgres";
const databaseUrl=process.env.TEST_READY_URL;
const adminUrl=process.env.TEST_ADMIN_URL;
if(!databaseUrl||!adminUrl)throw new Error("UPDATE 404 journey database URL missing");
const repository=createPostgresCalendarProjectionRepository(databaseUrl);
const admin=postgres(adminUrl,{max:1});
const calls=[];
let claimedJob;
let resetAttemptedEventLinkVersion;
const claim=repository.claim.bind(repository);
repository.claim=async(input)=>{
  const result=await claim(input);
  claimedJob=result.payload?.jobs?.[0];
  return result;
};
const resetEventExistence=repository.resetEventExistence.bind(repository);
repository.resetEventExistence=async(input)=>{
  calls.push("reset");
  const result=await resetEventExistence(input);
  resetAttemptedEventLinkVersion=result.payload?.attemptedEventLinkVersion;
  return result;
};
const markCreateDispatched=repository.markCreateDispatched.bind(repository);
repository.markCreateDispatched=async(input)=>{calls.push("mark");return markCreateDispatched(input);};
const crypto={
  decrypt:async(_value,aad)=>aad.startsWith("credential|")?"refresh":aad.startsWith("calendar_lookup_key|")?"lookup":"provider-calendar",
  encrypt:async()=>({ciphertext:new Uint8Array([1]),iv:new Uint8Array(12),keyVersion:1}),
  fingerprint:async()=>new Uint8Array(32),
};
const google={
  refresh:async()=>({accessToken:"memory",expiresIn:3600,scopes:[]}),
  getEvent:async(_access,_calendar,eventId)=>({id:eventId,etag:'"etag-before-404"',status:"confirmed",extendedProperties:{private:{werehereLink:Buffer.alloc(32).toString("base64url")}}}),
  updateEvent:async()=>{calls.push("update");throw GoogleCalendarProviderError.forStatus(404);},
  getCalendar:async()=>{calls.push("getCalendar");return {id:"provider-calendar",description:"werehere-link:v1:lookup"};},
  createEvent:async(_access,_calendar,event)=>{calls.push("create");return {id:event.id,etag:'"etag-after-create"',status:"confirmed",extendedProperties:{private:{werehereLink:event.linkKey}}};},
  deleteEvent:async()=>undefined,
};
try{
  const result=await reconcileGoogleCalendarCompany({repository,crypto,google,companyId:"10000000-0000-0000-0000-000000000001",limit:1,jitter:()=>0});
  if(result.claimed!==1)throw new Error(`UPDATE 404 journey claim count mismatch: ${result.claimed}`);
  const expected=["update","getCalendar","reset","mark","create"];
  if(JSON.stringify(calls)!==JSON.stringify(expected))throw new Error(`UPDATE 404 ordering mismatch: ${JSON.stringify(calls)}`);
  if(!claimedJob?.id||!claimedJob.eventLinkId||!claimedJob.attemptedSourceVersion||!resetAttemptedEventLinkVersion)
    throw new Error("UPDATE 404 exact claimed identity missing");
  const [state]=await admin`
    select job.id as job_id,job.status as job_status,
           event_link.id as event_link_id,event_link.status as event_link_status,
           event_link.version as event_link_version,event_link.applied_exists,
           event_link.applied_source_version,event_link.desired_source_version,
           not exists(
             select 1 from public.calendar_projection_jobs active_job
             where active_job.event_link_id=event_link.id
               and active_job.status in ('PENDING','PROCESSING','FAILED')
           ) as no_active_jobs
      from public.calendar_projection_jobs job
      join public.calendar_event_links event_link on event_link.id=job.event_link_id
     where job.id=${claimedJob.id}::uuid
       and job.event_link_id=${claimedJob.eventLinkId}::uuid
  `;
  if(!state||state.job_status!=="SUCCEEDED"||state.event_link_status!=="SYNCED"||state.applied_exists!==true||state.applied_source_version!==claimedJob.attemptedSourceVersion||state.desired_source_version!==claimedJob.attemptedSourceVersion||state.event_link_version!==resetAttemptedEventLinkVersion+1||state.no_active_jobs!==true)
    throw new Error(`UPDATE 404 exact journey did not converge: ${JSON.stringify(state)}`);
  console.log("GOOGLE_CALENDAR_UPDATE_404_RECONCILER_ACTUAL_JOURNEY_OK");
}finally{await Promise.allSettled([repository.close(),admin.end({timeout:1})]);}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_repair_visits set version=version+1 where id=(select visit_id from public.calendar_event_links where company_id='10000000-0000-0000-0000-000000000001' order by updated_at desc limit 1);
SQL
  event_job_id="$(psql -XqAt -v ON_ERROR_STOP=1 -d "$reconciler_url" <<'SQL'
with context as materialized (
  select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true)
)
select claim.result_snapshot->'jobs'->0->>'id'
from context cross join lateral public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('ab',32),'hex'),1) claim;
SQL
)"
  if [[ ! "$event_job_id" =~ ^[0-9a-f-]{36}$ ]]; then printf 'event claim fixture did not return a job id\n' >&2; return 1; fi
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" -v event_job_id="$event_job_id" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
select set_config('app.test_event_job_id',:'event_job_id',true);
do $stale_preflight$
declare result record;
begin
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',current_setting('app.test_event_job_id')::uuid,decode(repeat('ab',32),'hex'),'PREFLIGHT','NO_OP',null,null,null,null,null,null);
  if result.command_status<>'READY' then raise exception 'stale race preflight failed: %',result.command_status; end if;
  select * into result from public.calendar_projection_reset_event_existence_v1('10000000-0000-0000-0000-000000000001',current_setting('app.test_event_job_id')::uuid,decode(repeat('ab',32),'hex'));
  if result.command_status<>'EXISTENCE_RESET' then raise exception 'event 404 existence reset failed: %',result.command_status; end if;
end
$stale_preflight$;
commit;
SQL
  reset_state="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -c "select exists(select 1 from public.calendar_projection_jobs job join public.calendar_event_links event_link on event_link.company_id=job.company_id and event_link.id=job.event_link_id where job.id='$event_job_id'::uuid and job.status='PROCESSING' and job.create_dispatch_state='CREATE_NOT_ATTEMPTED' and job.attempted_event_link_version=event_link.version and not event_link.applied_exists and event_link.status='PENDING')")"
  if [[ "$reset_state" != "t" ]]; then
    printf '%s\n' 'event 404 reset did not atomically align applied existence and successor fence' >&2
    return 1
  fi
  printf '%s\n' 'GOOGLE_CALENDAR_EVENT_404_EXISTENCE_RESET_ACTUAL_DB_OK'
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_repair_visits set version=version+1 where id=(select visit_id from public.calendar_event_links where company_id='10000000-0000-0000-0000-000000000001' order by updated_at desc limit 1);
SQL
  local stale_event_link_id stale_event_source_version
  IFS='|' read -r stale_event_link_id stale_event_source_version <<<"$(psql -XqAt -F '|' -v ON_ERROR_STOP=1 -d "$admin_url" -c "select job.event_link_id,event_record.desired_source_version from public.calendar_projection_jobs job join public.calendar_event_links event_record on event_record.id=job.event_link_id where job.id='$event_job_id'::uuid")"
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" -v event_job_id="$event_job_id" -v event_link_id="$stale_event_link_id" -v source_version="$stale_event_source_version" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
select set_config('app.test_event_job_id',:'event_job_id',true),set_config('app.test_event_link_id',:'event_link_id',true),set_config('app.test_event_source_version',:'source_version',true);
do $stale_repair$
declare result record;
begin
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',current_setting('app.test_event_job_id')::uuid,decode(repeat('ab',32),'hex'),'SUCCEEDED','EVENT_UPDATE',null,null,null,null,null,2);
  if result.command_status<>'STALE_VERSION' then raise exception 'source race did not fence stale finalize: %',result.command_status; end if;
  select * into result from public.calendar_projection_repair_stale_v1('10000000-0000-0000-0000-000000000001',current_setting('app.test_event_job_id')::uuid);
  if result.command_status<>'NO_REPAIR' then raise exception 'superseded provider job remained repairable: %',result.command_status; end if;
  select * into result from public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('ac',32),'hex'),1);
  if result.command_status<>'OK' or result.result_snapshot->'jobs'->0->>'id'=current_setting('app.test_event_job_id') or result.result_snapshot->'jobs'->0->>'eventLinkId'<>current_setting('app.test_event_link_id') or result.result_snapshot->'jobs'->0->>'attemptedSourceVersion'<>current_setting('app.test_event_source_version') then raise exception 'fresh current-source event was not claimed'; end if;
end
$stale_repair$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" -v event_job_id="$event_job_id" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $disconnect_race$
declare result record; link_version integer;
begin
  select * into result from public.calendar_connection_status_read_v1('10000000-0000-0000-0000-000000000001',repeat('I',43));
  select (hotel->>'version')::integer into strict link_version from jsonb_array_elements(result.result_snapshot->'hotels') hotel where hotel->>'hotelId'='50000000-0000-4000-8000-000000000001' and hotel->>'linkStatus'='ACTIVE';
  select * into result from public.calendar_hotel_link_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020','50000000-0000-4000-8000-000000000001',repeat('I',43),'DISCONNECT',3,link_version,0,gen_random_uuid(),decode(repeat('01',32),'hex'),decode(repeat('02',12),'hex'),1,decode(repeat('03',32),'hex'),'연결 해제 경쟁 검증',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/hotel-link-command',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' then raise exception 'hotel disconnect race failed: %',result.command_status; end if;
end
$disconnect_race$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$reconciler_url" -v event_job_id="$event_job_id" >/dev/null <<'SQL'
begin;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
select set_config('app.test_event_job_id',:'event_job_id',true);
do $late_finalize$
declare result record;
begin
  select * into result from public.calendar_projection_finalize_v1('10000000-0000-0000-0000-000000000001',current_setting('app.test_event_job_id')::uuid,decode(repeat('ac',32),'hex'),'SUCCEEDED','EVENT_CREATE',null,null,null,null,null,1);
  if result.command_status<>'STALE_CLAIM' then raise exception 'disconnect did not invalidate late finalize: %',result.command_status; end if;
  select * into result from public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('ad',32),'hex'),10);
  if result.command_status<>'OK' or jsonb_array_length(result.result_snapshot->'jobs')<>0 then raise exception 'disconnected projection remained claimable'; end if;
end
$late_finalize$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -v event_job_id="$event_job_id" >/dev/null <<'SQL'
select set_config('app.test_event_job_id',:'event_job_id',false);
do $disconnect_assertions$
begin
  if not exists(select 1 from public.calendar_projection_jobs where id=current_setting('app.test_event_job_id')::uuid and status='SUPERSEDED' and claim_token_hash is null) then raise exception 'in-flight event job did not converge to superseded'; end if;
  if exists(select 1 from public.calendar_hotel_links where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and status<>'DISCONNECTED') then raise exception 'hotel link disconnect did not remain terminal'; end if;
  if not exists(select 1 from public.audit_events where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and event_code='CALENDAR_HOTEL_LINK_CREATE' and actor_user_id='2f000000-0000-4000-8000-000000000001' and session_id='4f000000-0000-4000-8000-000000000001' and char_length(btrim(reason)) between 2 and 500 and result='SUCCEEDED') then raise exception 'hotel link create audit was not preserved'; end if;
  if not exists(select 1 from public.audit_events where company_id='10000000-0000-0000-0000-000000000001' and branch_id='50000000-0000-4000-8000-000000000001' and event_code='CALENDAR_HOTEL_LINK_DISCONNECT' and reason='연결 해제 경쟁 검증' and actor_user_id='2f000000-0000-4000-8000-000000000001' and session_id='4f000000-0000-4000-8000-000000000001' and result='SUCCEEDED') then raise exception 'hotel link disconnect audit was not preserved'; end if;
end
$disconnect_assertions$;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$api_probe_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $recreate_and_reconnect$
declare result record; hotel jsonb; link_version integer; connection_version integer; next_credential_version integer;
begin
  select * into result from public.calendar_connection_status_read_v1('10000000-0000-0000-0000-000000000001',repeat('I',43));
  select value into strict hotel from jsonb_array_elements(result.result_snapshot->'hotels') where value->>'hotelId'='50000000-0000-4000-8000-000000000001';
  if hotel->>'linkStatus'<>'NOT_CREATED' or (hotel->>'generation')::integer<>1 then raise exception 'disconnected hotel lifetime generation was not preserved: %',hotel; end if;
  select * into result from public.calendar_hotel_link_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020','50000000-0000-4000-8000-000000000001',repeat('I',43),'CREATE',3,0,2,'ca440000-0000-4000-8000-000000000070',decode(repeat('71',48),'hex'),decode(repeat('72',12),'hex'),1,decode(repeat('73',32),'hex'),'generation 2 재생성',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/hotel-link-command',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'generation 2 recreate failed: %',result.command_status; end if;

  select (value->>'version')::integer into strict link_version from jsonb_array_elements(result.result_snapshot->'hotels') where value->>'hotelId'='50000000-0000-4000-8000-000000000001';
  select * into result from public.calendar_hotel_link_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020','50000000-0000-4000-8000-000000000001',repeat('I',43),'DISCONNECT',3,link_version,0,gen_random_uuid(),decode(repeat('01',32),'hex'),decode(repeat('02',12),'hex'),1,decode(repeat('03',32),'hex'),'회사 reconnect 준비',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/hotel-link-command',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' then raise exception 'generation 2 disconnect failed: %',result.command_status; end if;
  connection_version:=(result.result_snapshot->>'version')::integer;
  select * into result from public.calendar_connection_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',repeat('I',43),'DISCONNECT',connection_version,null,null,'[]'::jsonb,'fresh reconnect 검증',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/connection-command',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' or result.result_snapshot->>'connectionStatus'<>'DISCONNECTED' then raise exception 'company disconnect failed before reconnect: %',result.command_status; end if;
  connection_version:=(result.result_snapshot->>'version')::integer;
  select * into result from public.calendar_oauth_start_v1('10000000-0000-0000-0000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000071',decode(repeat('74',32),'hex'),decode(repeat('75',32),'hex'),decode(repeat('76',32),'hex'),decode(repeat('77',48),'hex'),decode(repeat('78',12),'hex'),1,'/admin/calendar',true,connection_version,1,gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/oauth-start',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'reconnect OAuth start failed: %',result.command_status; end if;
  select * into result from public.calendar_oauth_claim_v1(decode(repeat('74',32),'hex'),decode(repeat('75',32),'hex'),decode(repeat('79',32),'hex'));
  if result.command_status<>'CLAIMED' then raise exception 'disconnected reconnect claim failed: %',result.command_status; end if;
  next_credential_version:=(result.result_snapshot->>'credentialVersion')::integer;
  select * into result from public.calendar_oauth_finalize_v1('ca440000-0000-4000-8000-000000000071',decode(repeat('79',32),'hex'),'ca440000-0000-4000-8000-000000000020','ca440000-0000-4000-8000-000000000072',next_credential_version,decode(repeat('7a',48),'hex'),decode(repeat('7b',12),'hex'),1,decode(repeat('7c',32),'hex'),1,array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']);
  if result.command_status<>'CONNECTED' or result.result_snapshot->>'connectionStatus'<>'CONNECTED' then raise exception 'fresh reconnect finalize failed: %',result.command_status; end if;
  connection_version:=(result.result_snapshot->>'version')::integer;
  select * into result from public.calendar_hotel_link_command_v1('10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020','50000000-0000-4000-8000-000000000001',repeat('I',43),'CREATE',connection_version,0,3,'ca440000-0000-4000-8000-000000000073',decode(repeat('7d',48),'hex'),decode(repeat('7e',12),'hex'),1,decode(repeat('7f',32),'hex'),'exhaustion fixture',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/hotel-link-command',md5(gen_random_uuid()::text));
  if result.command_status<>'CREATED' then raise exception 'generation 3 create failed: %',result.command_status; end if;
end
$recreate_and_reconnect$;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user;
select set_config('app.reconciler_company_id','10000000-0000-0000-0000-000000000001',true);
do $exhausted_recovery$
declare result record; exhausted_job uuid; latest_job uuid; next_credential_version integer;
begin
  if not exists(select 1 from public.calendar_hotel_links where id='ca440000-0000-4000-8000-000000000070' and generation=2 and status='DISCONNECTED') then raise exception 'generation 2 history was not preserved'; end if;
  select id into strict exhausted_job from public.calendar_projection_jobs where hotel_link_id='ca440000-0000-4000-8000-000000000073' and status='PENDING';
  update public.calendar_projection_jobs set status='PROCESSING',attempt_count=8,claim_token_hash=decode(repeat('81',32),'hex'),claim_expires_at=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 minutes' where id=exhausted_job;
  select * into result from public.calendar_projection_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('82',32),'hex'),10);
  if result.command_status<>'OK' or jsonb_array_length(result.result_snapshot->'jobs')<>0 then raise exception 'exhausted projection remained claimable'; end if;
  if not exists(select 1 from public.calendar_projection_jobs where id=exhausted_job and status='DEAD_LETTER' and claim_token_hash is null and last_error_code='PROVIDER_RETRY_EXHAUSTED') then raise exception 'exhausted projection did not dead letter'; end if;
  if not exists(select 1 from public.calendar_hotel_links where id='ca440000-0000-4000-8000-000000000073' and status='ACTION_REQUIRED') then raise exception 'exhausted hotel link did not require action'; end if;
  if not exists(select 1 from public.calendar_sync_failures where job_id=exhausted_job and failure_code='PROVIDER_RETRY_EXHAUSTED' and status='OPEN') then raise exception 'exhausted projection failure missing'; end if;
  latest_job:='ca440000-0000-4000-8000-000000000074';
  insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,hotel_link_id,status,attempted_connection_version,attempt_count,last_error_code,completed_at,created_at) select latest_job,company_id,branch_id,aggregate_type,hotel_link_id,'DEAD_LETTER',attempted_connection_version,8,'LATEST_TERMINAL',statement_timestamp(),statement_timestamp()-interval '1 minute' from public.calendar_projection_jobs where id=exhausted_job;
  insert into public.calendar_sync_failures(id,company_id,branch_id,job_id,hotel_link_id,failure_code)
    select 'ca440000-0000-4000-8000-000000000076',company_id,branch_id,id,hotel_link_id,'LATEST_TERMINAL'
    from public.calendar_projection_jobs where id=latest_job;
  select coalesce(max(credential_version),0)+1 into next_credential_version from public.calendar_connection_credentials where company_id='10000000-0000-0000-0000-000000000001';
  insert into public.calendar_connection_credentials(id,company_id,connection_id,credential_version,lifecycle,refresh_credential_ciphertext,refresh_credential_iv,encryption_key_version,credential_fingerprint,granted_scopes,verification_attempt_count,verification_claim_token_hash,verification_claim_expires_at,created_by,originating_session_id) values('ca440000-0000-4000-8000-000000000075','10000000-0000-0000-0000-000000000001','ca440000-0000-4000-8000-000000000020',next_credential_version,'CANDIDATE',decode(repeat('83',48),'hex'),decode(repeat('84',12),'hex'),1,decode(repeat('85',32),'hex'),array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid'],8,decode(repeat('86',32),'hex'),statement_timestamp()-interval '1 second',(select user_id from public.auth_sessions where company_id='10000000-0000-0000-0000-000000000001' and id='4f000000-0000-4000-8000-000000000001'),'4f000000-0000-4000-8000-000000000001');
  select * into result from public.calendar_candidate_claim_v1('10000000-0000-0000-0000-000000000001',decode(repeat('87',32),'hex'));
  if result.command_status<>'OK' or result.result_snapshot->'candidate' is distinct from 'null'::jsonb then raise exception 'exhausted candidate remained claimable'; end if;
  if not exists(select 1 from public.calendar_connection_credentials where id='ca440000-0000-4000-8000-000000000075' and lifecycle='ACTION_REQUIRED' and verification_claim_token_hash is null) then raise exception 'exhausted candidate did not require action'; end if;
end
$exhausted_recovery$;
update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user;
commit;
SQL
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
select set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
do $latest_retry_only$
declare result record; pending_count integer; pending_connection_version integer; latest_connection_version integer;
begin
  select attempted_connection_version into strict latest_connection_version from public.calendar_projection_jobs where id='ca440000-0000-4000-8000-000000000074';
  select * into result from public.calendar_projection_failure_retry_v1('10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001',repeat('I',43),'ca440000-0000-4000-8000-000000000076',1,'exact terminal 하나만 재시도',gen_random_uuid(),gen_random_uuid()::text,'/api/test/calendar/failure-retry',md5(gen_random_uuid()::text));
  if result.command_status<>'UPDATED' then raise exception 'latest terminal retry failed: %',result.command_status; end if;
  select count(*),max(attempted_connection_version) into pending_count,pending_connection_version from public.calendar_projection_jobs where hotel_link_id='ca440000-0000-4000-8000-000000000073' and status='PENDING';
  if pending_count<>1 or pending_connection_version<>latest_connection_version then raise exception 'manual retry did not clone exactly latest terminal head'; end if;
end
$latest_retry_only$;
commit;
SQL
  cleanup_api_probe_role "$admin_url"
  printf 'GOOGLE_CALENDAR_PROJECTION_ACTUAL_DB_OK\n'
}

run_actual_scheduled_inspection_materializer_probe() {
  local admin_url="$1"
  local probe_status
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c "update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user" >/dev/null
  set +e
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$admin_url" pnpm exec tsx <<'NODE'
import { createPostgresInspectionMaterializerRepository } from "./packages/db/src/index.ts";
import { reconcileInspectionMaterializations } from "./apps/api/src/inspections/materializer.ts";

const repository = createPostgresInspectionMaterializerRepository(
  process.env.TEST_READY_URL,
);
try {
  const summary = await reconcileInspectionMaterializations({
    batchSize: 10,
    repository,
  });
  if (
    summary.claimedCount < 1 ||
    summary.claimedCount >= 10 ||
    summary.completedCount < 1 ||
    summary.createdInspectionCount < 1
  ) {
    throw new Error(`unexpected scheduled materializer summary: ${JSON.stringify(summary)}`);
  }
  console.log("HOTEL_INSPECTION_SCHEDULED_MATERIALIZER_ACTUAL_OK");
} finally {
  await repository.close();
}
NODE
  )
  probe_status=$?
  set -e
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c "update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user" >/dev/null
  return "$probe_status"
}

run_evidence_submit_concurrency_probe() {
  local admin_url="$1"
  local holder_log result_log holder_pid holder_ready result_status holder_status
  local result_line result_found
  holder_log="$(mktemp /tmp/gw-evidence-holder.XXXXXX)"
  result_log="$(mktemp /tmp/gw-evidence-result.XXXXXX)"

  PGAPPNAME=gw_evidence_submit_lock_holder \
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >"$holder_log" 2>&1 <<'SQL' &
begin;
update public.hotel_inspections
   set status = 'IN_REVIEW', updated_at = statement_timestamp()
 where company_id = '10000000-0000-0000-0000-000000000001'
   and id = 'c3000000-0000-4000-8000-000000000001';
select pg_sleep(2);
commit;
SQL
  holder_pid=$!
  holder_ready="f"
  for _ in $(seq 1 100); do
    holder_ready="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -c "select exists (select 1 from pg_catalog.pg_stat_activity where application_name = 'gw_evidence_submit_lock_holder' and state = 'active' and query like '%pg_sleep%')")"
    [[ "$holder_ready" == "t" ]] && break
    sleep 0.05
  done
  if [[ "$holder_ready" != "t" ]]; then
    kill "$holder_pid" 2>/dev/null || true
    wait "$holder_pid" 2>/dev/null || true
    rm -f "$holder_log" "$result_log"
    printf 'Evidence submission lock holder did not become ready.\n' >&2
    return 1
  fi

  set +e
  psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" >"$result_log" 2>&1 <<'SQL'
begin;
select set_config('app.session_id', '4f000000-0000-4000-8000-000000000001', true);
select command_status from public.hotel_inspection_command_v2(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'SAVE_RESULT', 1, '{}'::jsonb, repeat('I', 43),
  'fb000000-0000-4000-8000-000000000001',
  'concurrent-post-submit-save', 'PUT',
  '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/c3000000-0000-4000-8000-000000000001/items/result',
  'hash-concurrent-post-submit-save',
  'fb000000-0000-4000-8000-000000000002',
  'fb000000-0000-4000-8000-000000000003'
);
rollback;
SQL
  result_status=$?
  wait "$holder_pid"
  holder_status=$?
  set -e

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_inspections
   set status = 'COMPLETED', updated_at = statement_timestamp()
 where company_id = '10000000-0000-0000-0000-000000000001'
   and id = 'c3000000-0000-4000-8000-000000000001';
SQL

  result_found="f"
  while IFS= read -r result_line; do
    [[ "$result_line" == "INSPECTION_FINAL_LOCKED" ]] && result_found="t"
  done <"$result_log"
  if [[ "$result_status" -ne 0 || "$holder_status" -ne 0 || "$result_found" != "t" ]]; then
    printf '%s\n%s\n' "$(<"$holder_log")" "$(<"$result_log")" >&2
    rm -f "$holder_log" "$result_log"
    return 1
  fi
  rm -f "$holder_log" "$result_log"
  printf 'HOTEL_INSPECTION_EVIDENCE_CONCURRENCY_OK\n'
}

run_review_transition_idempotency_concurrency_probe() {
  local admin_url="$1"
  local first_log second_log first_pid second_pid first_status second_status
  local statuses
  first_log="$(mktemp /tmp/gw-review-idempotency-first.XXXXXX)"
  second_log="$(mktemp /tmp/gw-review-idempotency-second.XXXXXX)"

  psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_inspections
   set status = 'IN_REVIEW', version = version + 1,
       updated_at = statement_timestamp()
 where company_id = '10000000-0000-0000-0000-000000000001'
   and id = 'db300000-0000-4000-8000-000000000001';
update public.process_executions
   set state = 'IN_REVIEW', current_stage_key = 'RECHECK',
       current_reviewer_user_id = '2f000000-0000-4000-8000-000000000001',
       version = version + 1, completed_at = null
 where company_id = '10000000-0000-0000-0000-000000000001'
   and id = 'db400000-0000-4000-8000-000000000001';
delete from public.idempotency_records
 where company_id = '10000000-0000-0000-0000-000000000001'
   and idempotency_key = 'review-concurrent-same-key';
SQL

  local process_version
  process_version="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -c "select version from public.process_executions where company_id = '10000000-0000-0000-0000-000000000001' and id = 'db400000-0000-4000-8000-000000000001'")"

  run_call() {
    local output_file="$1"
    psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" >"$output_file" 2>&1 <<SQL
begin;
select set_config('app.session_id', '4f000000-0000-4000-8000-000000000001', true);
select command_status from public.hotel_inspection_transition_v1(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'db300000-0000-4000-8000-000000000001',
  ${process_version},
  jsonb_build_object(
    'historyId', 'db990000-0000-4000-8000-000000000099',
    'event', 'APPROVE', 'choiceValue', null,
    'reason', '동일 멱등키 동시 승인'
  ),
  repeat('I', 43), gen_random_uuid(), 'review-concurrent-same-key',
  '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/db300000-0000-4000-8000-000000000001/process/transition',
  'hash-review-concurrent-same-session', gen_random_uuid(), gen_random_uuid()
);
commit;
SQL
  }

  set +e
  run_call "$first_log" & first_pid=$!
  run_call "$second_log" & second_pid=$!
  wait "$first_pid"; first_status=$?
  wait "$second_pid"; second_status=$?
  set -e
  statuses="$(printf '%s\n%s\n' "$(<"$first_log")" "$(<"$second_log")" | grep -E '^(UPDATED|REPLAYED)$' | sort | tr '\n' ' ')"
  if [[ "$first_status" -ne 0 || "$second_status" -ne 0 || "$statuses" != "REPLAYED UPDATED " ]]; then
    printf '%s\n%s\n' "$(<"$first_log")" "$(<"$second_log")" >&2
    rm -f "$first_log" "$second_log"
    return 1
  fi
  rm -f "$first_log" "$second_log"
  printf 'HOTEL_INSPECTION_REVIEW_IDEMPOTENCY_CONCURRENCY_OK\n'
}

assert_inspection_runtime_acl() {
  local probe_url="$1"
  local result
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$probe_url" <<'SQL'
select
  has_function_privilege(current_user,
    'public.hotel_file_scan_command_v1(uuid,text,text,bigint,jsonb,uuid)', 'EXECUTE')
  and has_function_privilege(current_user,
    'public.hotel_file_scan_candidates_v1(integer)', 'EXECUTE')
  and has_function_privilege(current_user,
    'public.hotel_inspection_claim_materialization_v1(uuid,bytea,integer)', 'EXECUTE')
  and has_function_privilege(current_user,
    'public.hotel_inspection_complete_materialization_v1(uuid,bigint,bytea,uuid)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_process_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_process_default_read_v1(uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_process_reviewer_candidates_v1(uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_inspection_routines_read_v1(uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_inspection_routine_command_v1(uuid,uuid,uuid,integer,jsonb,text,text,text,text,text,uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_inspection_executions_read_v1(uuid,uuid,uuid,jsonb,text)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_inspection_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_inspection_command_v2(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege(current_user,
    'public.hotel_file_upload_scope_v1(uuid,uuid,text)', 'EXECUTE')
  and exists (
    select 1 from public.hotel_file_finalizer_capabilities
     where role_name = current_user
  )
  and not exists (
    select 1
      from (values
        ('process_definitions'), ('process_executions'), ('hotel_inspections'),
        ('inspection_item_results'), ('hotel_file_uploads'),
        ('hotel_file_scan_jobs'), ('hotel_file_versions'), ('hotel_file_links')
      ) protected(table_name)
     where has_table_privilege(current_user, 'public.' || protected.table_name, 'INSERT')
        or has_table_privilege(current_user, 'public.' || protected.table_name, 'UPDATE')
        or has_table_privilege(current_user, 'public.' || protected.table_name, 'DELETE')
  );
SQL
)"
  if [[ "$result" != "t" ]]; then
    printf 'Inspection runtime ACL is not exact.\n' >&2
    return 1
  fi
}

assert_schema_not_ready() {
  local probe_url="$1"
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$probe_url" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const result = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (result.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY, received ${result.status}`);
}
NODE
  )
}

assert_schema_ready() {
  local probe_url="$1"
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$probe_url" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

let checkpoint = "NONE";
const result = await probeDatabaseReadiness(process.env.TEST_READY_URL, {
  capability: "RECONCILER",
  onSchemaNotReady: (value) => {
    checkpoint = value;
  },
});
if (result.status !== "READY") {
  throw new Error(`expected READY, received ${result.status} at ${checkpoint}`);
}
NODE
  )
}

assert_google_calendar_projection_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.calendar_projection_jobs no force row level security' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.calendar_projection_jobs force row level security' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.calendar_projection_mark_create_dispatched_v1(uuid,uuid,bytea) security invoker' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.calendar_projection_mark_create_dispatched_v1(uuid,uuid,bytea) security definer' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.calendar_projection_evidence_read_v1(uuid,text,bytea,uuid,integer,uuid,timestamptz) security invoker' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.calendar_projection_evidence_read_v1(uuid,text,bytea,uuid,integer,uuid,timestamptz) security definer' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.calendar_authorization_lock_v1(uuid,uuid,uuid) security invoker' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.calendar_authorization_lock_v1(uuid,uuid,uuid) security definer' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.calendar_projection_jobs drop constraint calendar_projection_jobs_attempt_count_check, add constraint calendar_projection_jobs_attempt_count_check check(attempt_count>=0)' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.calendar_projection_jobs drop constraint calendar_projection_jobs_attempt_count_check, add constraint calendar_projection_jobs_attempt_count_check check(attempt_count between 0 and 8)' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter policy calendar_projection_jobs_company_isolation on public.calendar_projection_jobs to current_user' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter policy calendar_projection_jobs_company_isolation on public.calendar_projection_jobs to public' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'drop trigger calendar_projection_visit_signal on public.hotel_repair_visits; create trigger calendar_projection_visit_signal after insert on public.hotel_repair_visits for each row execute function public.calendar_projection_visit_signal_v1()' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'drop trigger calendar_projection_visit_signal on public.hotel_repair_visits; create trigger calendar_projection_visit_signal after insert or update of title,starts_at,ends_at,status,version on public.hotel_repair_visits for each row execute function public.calendar_projection_visit_signal_v1()' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'create index calendar_projection_jobs_unexpected_extra on public.calendar_projection_jobs(company_id)' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'drop index public.calendar_projection_jobs_unexpected_extra' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.calendar_crypto_settings drop constraint calendar_crypto_settings_current_hmac_key_version_check, add constraint calendar_crypto_settings_current_hmac_key_version_check check(current_hmac_key_version>=0)' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.calendar_crypto_settings drop constraint calendar_crypto_settings_current_hmac_key_version_check, add constraint calendar_crypto_settings_current_hmac_key_version_check check(current_hmac_key_version>=1)' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'grant select on public.calendar_crypto_settings to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'revoke select on public.calendar_crypto_settings from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'grant execute on function public.repair_idempotency_store_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,jsonb) to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'revoke execute on function public.repair_idempotency_store_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,jsonb) from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.repair_idempotency_begin_v1(uuid,uuid,text,text,text,text) security invoker' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.repair_idempotency_begin_v1(uuid,uuid,text,text,text,text) security definer' >/dev/null
  assert_schema_ready "$probe_url"
  printf 'GOOGLE_CALENDAR_IDEMPOTENCY_HELPER_READINESS_DAMAGE_OK\n'
  printf 'GOOGLE_CALENDAR_CRYPTO_SETTINGS_READINESS_DAMAGE_OK\n'
  printf 'GOOGLE_CALENDAR_PROJECTION_READINESS_DAMAGE_OK\n'
}

assert_checklist_expand_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  local sync_definition
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter function public.inspection_checklist_v2_snapshot_v1(uuid,uuid) security invoker' \
    >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter function public.inspection_checklist_v2_snapshot_v1(uuid,uuid) security definer' \
    >/dev/null
  assert_schema_ready "$probe_url"
  sync_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" -c \
    "select pg_catalog.pg_get_functiondef('public.inspection_checklist_v1_sync_v2()'::pg_catalog.regprocedure)")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
create or replace function public.inspection_checklist_v1_sync_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  return new;
end
$function$;
SQL
  assert_schema_not_ready "$probe_url"
  printf '%s\n' "$sync_definition" | \
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null
  assert_schema_ready "$probe_url"
  printf 'HOTEL_INSPECTION_CHECKLIST_EXPAND_READINESS_DAMAGE_OK\n'
}

assert_checklist_v2_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table public.inspection_checklist_v2_item_exclusions
  drop constraint inspection_checklist_v2_exclusions_target_check;
alter table public.inspection_checklist_v2_item_exclusions
  add constraint inspection_checklist_v2_exclusions_target_check check (true);
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table public.inspection_checklist_v2_item_exclusions
  drop constraint inspection_checklist_v2_exclusions_target_check;
alter table public.inspection_checklist_v2_item_exclusions
  add constraint inspection_checklist_v2_exclusions_target_check check (
    (target_type = 'ROOM' and room_type_id is not null and facility_type_id is null)
    or
    (target_type = 'FACILITY' and room_type_id is null and facility_type_id is not null)
  );
SQL
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter function public.inspection_checklist_v2_snapshot_v1(uuid, uuid)
  security invoker;
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter function public.inspection_checklist_v2_snapshot_v1(uuid, uuid)
  security definer;
SQL
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
create or replace function public.inspection_checklist_v1_sync_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  return new;
end
$function$;
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -f "$ROOT_DIR/packages/db/migrations/0039_hotel_inspection_checklist_v2_hardening.sql" \
    >/dev/null
  assert_schema_ready "$probe_url"
  printf 'HOTEL_INSPECTION_CHECKLIST_V2_READINESS_DAMAGE_OK\n'
}

assert_review_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"

  printf 'REVIEW_DAMAGE_BASELINE_CHECK\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "delete from public.schema_migrations where version = '0035_hotel_inspection_review_and_file_view'" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "insert into public.schema_migrations(version) values ('0035_hotel_inspection_review_and_file_view')" >/dev/null
  printf 'REVIEW_DAMAGE_MARKER_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "alter table public.hotel_file_access_grants no force row level security" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "alter table public.hotel_file_access_grants force row level security" >/dev/null
  printf 'REVIEW_DAMAGE_RLS_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter policy hotel_file_access_grants_company_isolation
  on public.hotel_file_access_grants
  using (true)
  with check (true);
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter policy hotel_file_access_grants_company_isolation
  on public.hotel_file_access_grants
  using ((
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_auth_session_definer' then true
      when current_user = 'werehere_tenant_authority_definer' then true
      when public.runtime_has_capability('API_RUNTIME')
        then company_id = public.api_current_company_id()
      when public.runtime_has_capability('RECONCILER')
        then company_id = public.reconciler_current_company_id()
      else false
    end
  ))
  with check ((
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_auth_session_definer' then true
      when current_user = 'werehere_tenant_authority_definer' then true
      when public.runtime_has_capability('API_RUNTIME')
        then company_id = public.api_current_company_id()
      when public.runtime_has_capability('RECONCILER')
        then company_id = public.reconciler_current_company_id()
      else false
    end
  ));
SQL
  printf 'REVIEW_DAMAGE_POLICY_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "create policy hotel_file_access_grants_attacker_allow on public.hotel_file_access_grants using (true) with check (true)" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "drop policy hotel_file_access_grants_attacker_allow on public.hotel_file_access_grants" >/dev/null
  printf 'REVIEW_DAMAGE_EXTRA_POLICY_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "create policy hotel_file_access_grants_role_scoped_attacker_allow on public.hotel_file_access_grants to werehere_tenant_authority_definer using (true) with check (true)" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "drop policy hotel_file_access_grants_role_scoped_attacker_allow on public.hotel_file_access_grants" >/dev/null
  printf 'REVIEW_DAMAGE_ROLE_SCOPED_EXTRA_POLICY_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "alter table public.hotel_file_access_grants drop constraint hotel_file_access_grants_expiry_check" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "alter table public.hotel_file_access_grants add constraint hotel_file_access_grants_expiry_check check (expires_at > started_at)" >/dev/null
  printf 'REVIEW_DAMAGE_CONSTRAINT_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "alter function public.hotel_inspection_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid) set search_path = public" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "alter function public.hotel_inspection_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid) set search_path = pg_catalog" >/dev/null
  printf 'REVIEW_DAMAGE_SEARCH_PATH_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "grant execute on function public.hotel_inspection_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid) to gw_runtime_probe" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "revoke execute on function public.hotel_inspection_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid) from gw_runtime_probe" >/dev/null
  printf 'REVIEW_DAMAGE_EXECUTE_RESTORED\n'
  assert_schema_ready "$probe_url"

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "grant select(file_version_id) on public.hotel_file_access_grants to gw_runtime_probe" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "revoke select(file_version_id) on public.hotel_file_access_grants from gw_runtime_probe" >/dev/null
  printf 'REVIEW_DAMAGE_COLUMN_RESTORED\n'
  assert_schema_ready "$probe_url"

  printf 'HOTEL_INSPECTION_REVIEW_READINESS_DAMAGE_OK\n'
}

register_owner_api_capability() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
do $grant$
begin
  execute format(
    'grant werehere_tenant_authority_definer to %I with inherit false, set true',
    session_user
  );
end
$grant$;
set local role werehere_tenant_authority_definer;
insert into public.runtime_database_capabilities (role_name, capability)
values (session_user, 'API_RUNTIME')
on conflict (role_name) do update set capability = excluded.capability;
reset role;
do $revoke$
begin
  execute format(
    'revoke werehere_tenant_authority_definer from %I granted by %I',
    session_user,
    session_user
  );
end
$revoke$;
commit;
SQL
}

assert_room_constraints_exact() {
  local admin_url="$1"
  local probe_url="$2"
  local specification table_name constraint_name definition
  local dependent_specification dependent_table dependent_constraint dependent_definition
  local -a dependent_specifications dependent_definitions
  local dependent_index
  local constraints=(
    "hotel_room_types:hotel_room_types_pkey"
    "hotel_room_types:hotel_room_types_company_id_fkey"
    "hotel_room_types:hotel_room_types_company_id_branch_id_fkey"
    "hotel_room_types:hotel_room_types_company_id_created_by_fkey"
    "hotel_room_types:hotel_room_types_company_id_updated_by_fkey"
    "hotel_room_types:hotel_room_types_company_id_id_key"
    "hotel_room_types:hotel_room_types_company_id_branch_id_normalized_name_key"
    "hotel_room_types:hotel_room_types_scope_check"
    "hotel_room_types:hotel_room_types_scope_shape"
    "hotel_room_types:hotel_room_types_name_check"
    "hotel_room_types:hotel_room_types_display_order_check"
    "hotel_room_types:hotel_room_types_version_check"
    "hotel_rooms:hotel_rooms_pkey"
    "hotel_rooms:hotel_rooms_company_id_fkey"
    "hotel_rooms:hotel_rooms_company_id_branch_id_fkey"
    "hotel_rooms:hotel_rooms_company_id_room_type_id_fkey"
    "hotel_rooms:hotel_rooms_company_id_created_by_fkey"
    "hotel_rooms:hotel_rooms_company_id_updated_by_fkey"
    "hotel_rooms:hotel_rooms_company_id_id_key"
    "hotel_rooms:hotel_rooms_company_branch_id_key"

    "hotel_rooms:hotel_rooms_room_number_check"
    "hotel_rooms:hotel_rooms_room_number_canonical_check"
    "hotel_rooms:hotel_rooms_floor_label_check"
    "hotel_rooms:hotel_rooms_floor_sort_key_check"
    "hotel_rooms:hotel_rooms_status_check"

    "hotel_rooms:hotel_rooms_internal_note_check"
    "hotel_rooms:hotel_rooms_owner_visible_note_check"
    "hotel_rooms:hotel_rooms_version_check"
    "hotel_room_status_history:hotel_room_status_history_pkey"
    "hotel_room_status_history:hotel_room_status_history_company_id_fkey"
    "hotel_room_status_history:hotel_room_status_history_company_id_branch_id_fkey"
    "hotel_room_status_history:hotel_room_status_history_room_hotel_fkey"
    "hotel_room_status_history:hotel_room_status_history_company_id_changed_by_fkey"
    "hotel_room_status_history:hotel_room_status_history_previous_status_check"
    "hotel_room_status_history:hotel_room_status_history_next_status_check"
    "hotel_room_status_history:hotel_room_status_history_reason_check"
    "hotel_room_status_history:hotel_room_status_history_transition"
    "hotel_room_status_history:hotel_room_status_history_source_shape"
  )

  for specification in "${constraints[@]}"; do
    table_name="${specification%%:*}"
    constraint_name="${specification#*:}"
    dependent_specifications=()
    dependent_definitions=()
    if [[ "$constraint_name" == "hotel_room_types_company_id_id_key" ]]; then
      dependent_specifications=(
        "hotel_rooms:hotel_rooms_company_id_room_type_id_fkey"
        "inspection_checklist_items:inspection_checklist_items_company_id_room_type_id_fkey"
        "inspection_checklist_item_exclusions:inspection_checklist_item_exclusio_company_id_room_type_id_fkey"
        "inspection_checklist_v2_items:inspection_checklist_v2_items_room_type_fkey"
        "inspection_checklist_v2_item_exclusions:inspection_checklist_v2_exclusions_room_type_fkey"
      )
    elif [[ "$constraint_name" == "hotel_rooms_company_branch_id_key" ]]; then
      dependent_specifications=(
        "hotel_room_status_history:hotel_room_status_history_room_hotel_fkey"
        "inspection_item_snapshots:inspection_item_snapshots_company_id_branch_id_room_id_fkey"
        "hotel_facilities:hotel_facilities_room_fkey"
        "inspection_execution_targets:inspection_execution_targets_room_fkey"
      )
    fi
    definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
      -v constraint_name="$constraint_name" <<'SQL'
select pg_get_constraintdef(oid, true)
from pg_constraint
where conname = :'constraint_name';
SQL
)"
    if [[ -z "$definition" ]]; then
      printf 'Missing room constraint before damage probe: %s\n' "$constraint_name" >&2
      return 1
    fi
    for dependent_specification in "${dependent_specifications[@]}"; do
      dependent_table="${dependent_specification%%:*}"
      dependent_constraint="${dependent_specification#*:}"
      dependent_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
        -v constraint_name="$dependent_constraint" <<'SQL'
select pg_get_constraintdef(oid, true)
from pg_constraint
where conname = :'constraint_name';
SQL
)"
      if [[ -z "$dependent_definition" ]]; then
        printf 'Missing dependent room constraint before damage probe: %s\n' "$dependent_constraint" >&2
        return 1
      fi
      dependent_definitions+=("$dependent_definition")
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
        -v table_name="$dependent_table" -v constraint_name="$dependent_constraint" >/dev/null <<'SQL'
select format('alter table %I drop constraint %I', :'table_name', :'constraint_name') \gexec
SQL
    done
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
      -v table_name="$table_name" -v constraint_name="$constraint_name" >/dev/null <<'SQL'
select format('alter table %I drop constraint %I', :'table_name', :'constraint_name') \gexec
SQL
    (
      cd "$ROOT_DIR"
      TEST_READY_URL="$probe_url" ROOM_CONSTRAINT="$constraint_name" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after ${process.env.ROOM_CONSTRAINT} damage, received ${damaged.status}`);
}
NODE
    )
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
      -v table_name="$table_name" -v constraint_name="$constraint_name" \
      -v definition="$definition" >/dev/null <<'SQL'
select format(
  'alter table %I add constraint %I %s',
  :'table_name', :'constraint_name', :'definition'
) \gexec
SQL
    for dependent_index in "${!dependent_specifications[@]}"; do
      dependent_specification="${dependent_specifications[$dependent_index]}"
      dependent_table="${dependent_specification%%:*}"
      dependent_constraint="${dependent_specification#*:}"
      dependent_definition="${dependent_definitions[$dependent_index]}"
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
        -v table_name="$dependent_table" -v constraint_name="$dependent_constraint" \
        -v definition="$dependent_definition" >/dev/null <<'SQL'
select format(
  'alter table %I add constraint %I %s',
  :'table_name', :'constraint_name', :'definition'
) \gexec
SQL
    done
  done
}

assert_room_fingerprint_damage() {
  local admin_url="$1"
  local probe_url="$2"
  local definition trigger_definition trigger_name

  probe_room_damage() {
    local damage_label="$1"
    (
      cd "$ROOT_DIR"
      TEST_READY_URL="$probe_url" DAMAGE_LABEL="$damage_label" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after ${process.env.DAMAGE_LABEL}, received ${damaged.status}`);
}
NODE
    )
  }

  definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select pg_get_constraintdef(oid, true)
from pg_constraint
where conrelid = 'public.hotel_rooms'::regclass
  and conname = 'hotel_rooms_status_check';
SQL
)"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table hotel_rooms drop constraint hotel_rooms_status_check;
alter table hotel_rooms add constraint hotel_rooms_status_check
  check (status in ('ACTIVE', 'INACTIVE', 'DELETED', 'BROKEN'));
SQL
  probe_room_damage "weakened hotel room status CHECK literal damage"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -v definition="$definition" >/dev/null <<'SQL'
alter table hotel_rooms drop constraint hotel_rooms_status_check;
select format('alter table hotel_rooms add constraint hotel_rooms_status_check %s', :'definition') \gexec
SQL

  for trigger_name in hotel_room_types_scope_immutable hotel_rooms_room_type_scope_guard; do
    trigger_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
      -v trigger_name="$trigger_name" <<'SQL'
select pg_get_triggerdef(oid, true)
from pg_trigger
where tgrelid = case :'trigger_name'
  when 'hotel_room_types_scope_immutable' then 'public.hotel_room_types'::regclass
  else 'public.hotel_rooms'::regclass
end
and tgname = :'trigger_name';
SQL
)"
    if [[ "$trigger_name" == "hotel_room_types_scope_immutable" ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop trigger hotel_room_types_scope_immutable on hotel_room_types;
create trigger hotel_room_types_scope_immutable
before update of company_id on hotel_room_types
for each row execute function public.reject_hotel_room_type_scope_change();
SQL
    else
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop trigger hotel_rooms_room_type_scope_guard on hotel_rooms;
create trigger hotel_rooms_room_type_scope_guard
before insert or update of company_id on hotel_rooms
for each row execute function public.enforce_hotel_room_type_scope();
SQL
    fi
    probe_room_damage "partial ${trigger_name} protected-column damage"
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
      -v trigger_name="$trigger_name" -v definition="$trigger_definition" >/dev/null <<'SQL'
select format(
  'drop trigger %I on %s',
  :'trigger_name',
  case :'trigger_name'
    when 'hotel_room_types_scope_immutable' then 'hotel_room_types'
    else 'hotel_rooms'
  end
) \gexec
select :'definition' \gexec
SQL
  done

  for trigger_name in hotel_rooms_deleted_immutable hotel_room_status_history_insert_guard; do
    trigger_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
      -v trigger_name="$trigger_name" <<'SQL'
select pg_get_functiondef(trigger_proc.oid)
from pg_trigger trigger_record
join pg_proc trigger_proc on trigger_proc.oid = trigger_record.tgfoid
where trigger_record.tgname = :'trigger_name';
SQL
)"
    if [[ "$trigger_name" == "hotel_rooms_deleted_immutable" ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
create or replace function public.reject_deleted_hotel_room_change()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin return new; end $$;
SQL
    else
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
create or replace function public.enforce_new_hotel_room_history_insert()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin return new; end $$;
SQL
    fi
    probe_room_damage "no-op ${trigger_name} function body damage"
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
      -v definition="$trigger_definition" >/dev/null <<'SQL'
select :'definition' \gexec
SQL
  done

  local lifecycle_command_definition
  lifecycle_command_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select pg_get_functiondef(
  'public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)'::regprocedure
);
SQL
)"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
create or replace function public.hotel_room_lifecycle_command_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_room_id uuid,
  p_expected_version integer,
  p_next_status text,
  p_reason text,
  p_history_id uuid,
  p_audit_event_id uuid,
  p_idempotency_record_id uuid,
  p_idempotency_key text,
  p_http_method text,
  p_operation_path text,
  p_request_hash text,
  p_session_token text,
  p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $$ begin return query select 'FORBIDDEN'::text, null::jsonb; end $$;
SQL
  probe_room_damage "no-op hotel room lifecycle command body damage"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -v definition="$lifecycle_command_definition" >/dev/null <<'SQL'
select :'definition' \gexec
SQL

  local write_command_definition
  write_command_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select pg_get_functiondef(
  'public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid)'::regprocedure
);
SQL
)"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
create or replace function public.hotel_room_write_command_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_room_id uuid,
  p_action text,
  p_expected_version integer,
  p_value jsonb,
  p_audit_event_id uuid,
  p_idempotency_record_id uuid,
  p_idempotency_key text,
  p_http_method text,
  p_operation_path text,
  p_request_hash text,
  p_session_token text,
  p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $$ begin return query select 'FORBIDDEN'::text, null::jsonb; end $$;
SQL
  probe_room_damage "no-op hotel room write command body damage"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -v definition="$write_command_definition" >/dev/null <<'SQL'
select :'definition' \gexec
SQL

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $acl_damage$
declare
  approved_role text;
begin
  select role_name into strict approved_role
    from runtime_database_capabilities
   where capability = 'API_RUNTIME'
   order by role_name
   limit 1;
  if approved_role is null then
    raise exception 'API_RUNTIME capability fixture is missing';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'gw_room_acl_drift') then
    create role gw_room_acl_drift nologin;
  end if;
  execute format(
    'revoke execute on function public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid) from %I',
    approved_role
  );
  execute format(
    'revoke execute on function public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid) from %I',
    approved_role
  );
  grant execute on function public.hotel_room_lifecycle_command_v1(
    uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid
  ) to gw_room_acl_drift;
  grant execute on function public.hotel_room_write_command_v1(
    uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid
  ) to gw_room_acl_drift;
end
$acl_damage$;
SQL
  probe_room_damage "same-count hotel room command ACL grantee drift"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $acl_restore$
declare
  approved_role text;
begin
  select role_name into strict approved_role
    from runtime_database_capabilities
   where capability = 'API_RUNTIME'
   order by role_name
   limit 1;
  revoke all privileges on function public.hotel_room_lifecycle_command_v1(
    uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid
  ) from gw_room_acl_drift;
  revoke all privileges on function public.hotel_room_write_command_v1(
    uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid
  ) from gw_room_acl_drift;
  execute format(
    'grant execute on function public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid) to %I',
    approved_role
  );
  execute format(
    'grant execute on function public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid) to %I',
    approved_role
  );
end
$acl_restore$;
drop role gw_room_acl_drift;
SQL


  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
create function public.hotel_room_lifecycle_command_v1()
returns void language sql as 'select';
SQL
  probe_room_damage "hotel room lifecycle command overload drift"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop function public.hotel_room_lifecycle_command_v1();
SQL

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter policy hotel_rooms_company_isolation on hotel_rooms to gw_runtime_probe;
SQL
  probe_room_damage "hotel rooms RLS role contraction"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter policy hotel_rooms_company_isolation on hotel_rooms to public;
SQL
}

assert_legacy_auth_removed() {
  local admin_url="$1"
  local removed
  removed="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select to_regprocedure(
  'public.auth_create_session(uuid,bytea,text,integer,integer,timestamptz,uuid)'
) is null;
SQL
)"
  if [[ "$removed" != "t" ]]; then
    printf '%s\n' 'Contract retained the legacy auth_create_session function.' >&2
    return 1
  fi
}
assert_expand_isolated() {
  local admin_url="$1"
  local result
  result="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select concat(
  (select status || ':' || failure_code
   from account_provisioning_attempts
   where id = '1a110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || last_error_code
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || coalesce(last_error_code, 'NULL')
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000003')
);
delete from outbox_jobs where id in (
  '1b110000-0000-4000-8000-000000000001',
  '1b110000-0000-4000-8000-000000000003'
);
delete from account_provisioning_attempts where id = '1a110000-0000-4000-8000-000000000001';
alter table users disable trigger users_no_delete;
delete from users where id = '1c110000-0000-4000-8000-000000000001';
alter table users enable trigger users_no_delete;
delete from companies where id = '1d110000-0000-4000-8000-000000000001';
SQL
)"
  if [[ "$result" != "DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE" ]]; then
    printf 'EXPAND did not isolate pre-existing legacy compensation: %s\n' "$result" >&2
    return 1
  fi
}

assert_exact_contract_isolated() {
  local admin_url="$1"
  local result
  result="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select concat(
  (select status || ':' || failure_code
   from account_provisioning_attempts
   where id = '1a110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || last_error_code
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || coalesce(last_error_code, 'NULL')
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000003'),
  '|',
  exists (
    select 1 from pg_constraint
    where conname = 'outbox_jobs_compensation_linkage_check'
      and conrelid = 'public.outbox_jobs'::regclass
  )
);
do $constraint_probe$
begin
  begin
    insert into outbox_jobs (id, company_id, job_type, payload, status)
    values (
      '1b110000-0000-4000-8000-000000000002',
      '1d110000-0000-4000-8000-000000000001',
      'ACCOUNT_PROVIDER_COMPENSATE',
      '{"userId":"1e110000-0000-4000-8000-000000000001","providerSubject":"legacy-provider-subject","action":"COMPENSATE"}'::jsonb,
      'PENDING'
    );
    raise exception 'unsafe compensation payload passed exact linkage check';
  exception when check_violation then
    null;
  end;
end
$constraint_probe$;
delete from outbox_jobs where id in (
  '1b110000-0000-4000-8000-000000000001',
  '1b110000-0000-4000-8000-000000000003'
);
delete from account_provisioning_attempts where id = '1a110000-0000-4000-8000-000000000001';
alter table users disable trigger users_no_delete;
delete from users where id = '1c110000-0000-4000-8000-000000000001';
alter table users enable trigger users_no_delete;
delete from companies where id = '1d110000-0000-4000-8000-000000000001';
SQL
)"
  if [[ "$result" != "DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|t" ]]; then
    printf 'Legacy compensation migration did not isolate unsafe provider work: %s\n' "$result" >&2
    return 1
  fi
}

seed_legacy_compensation() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
insert into companies (id, legal_name)
values ('1d110000-0000-4000-8000-000000000001', 'Legacy Compensation Test');
insert into users (id, company_id, user_type, display_name, status)
values (
  '1c110000-0000-4000-8000-000000000001',
  '1d110000-0000-4000-8000-000000000001',
  'INTERNAL_STAFF', 'Legacy Actor', 'ACTIVE'
);
insert into account_provisioning_attempts (
  id, company_id, actor_user_id, target_user_id, idempotency_key,
  request_hash, completion_payload, status, provider_subject, failure_code,
  dispatched_at, provider_confirmed_at, compensation_required_at,
  lease_expires_at, expires_at
) values (
  '1a110000-0000-4000-8000-000000000001',
  '1d110000-0000-4000-8000-000000000001',
  '1c110000-0000-4000-8000-000000000001',
  '1e110000-0000-4000-8000-000000000001',
  'legacy-compensation', 'legacy-request',
  '{"userId":"1e110000-0000-4000-8000-000000000001","action":"CREATE"}'::jsonb,
  'COMPENSATION_REQUIRED', 'legacy-provider-subject', 'DB_COMPLETION_FAILED',
  now(), now(), now(), now() + interval '2 minutes', now() + interval '24 hours'
);
insert into outbox_jobs (
  id, company_id, job_type, payload, status, locked_at, claim_token
) values
(
  '1b110000-0000-4000-8000-000000000001',
  '1d110000-0000-4000-8000-000000000001',
  'ACCOUNT_PROVIDER_COMPENSATE',
  '{"userId":"1e110000-0000-4000-8000-000000000001","providerSubject":"legacy-provider-subject","action":"COMPENSATE"}'::jsonb,
  'PROCESSING', now(), '1f110000-0000-4000-8000-000000000001'
),
(
  '1b110000-0000-4000-8000-000000000003',
  '1d110000-0000-4000-8000-000000000001',
  'ACCOUNT_PROVIDER_COMPENSATE',
  '{"userId":"1e110000-0000-4000-8000-000000000001","providerSubject":"legacy-provider-subject","action":"COMPENSATE","provisioningAttemptId":"1a110000-0000-4000-8000-000000000099","originalErrorCode":"ACCOUNT_DUPLICATE"}'::jsonb,
  'PENDING', null, null
);
SQL
}

MIGRATION="$ROOT_DIR/packages/db/migrations/0001_platform_foundation.sql"
AUTH_MIGRATION="$ROOT_DIR/packages/db/migrations/0002_auth_session_runtime.sql"
HOTEL_MIGRATION="$ROOT_DIR/packages/db/migrations/0003_hotel_basic_information.sql"
CUSTOM_LOGIN_MIGRATION="$ROOT_DIR/packages/db/migrations/0004_custom_login_security.sql"
SESSION_DEFINER_MIGRATION="$ROOT_DIR/packages/db/migrations/0005_auth_session_definer.sql"
ACCOUNT_MIGRATION="$ROOT_DIR/packages/db/migrations/0006_account_administration.sql"
TENANT_AUTHORITY_MIGRATION="$ROOT_DIR/packages/db/migrations/0007_api_tenant_authority_expand.sql"
GLOBAL_LOGIN_EXPAND_MIGRATION="$ROOT_DIR/packages/db/migrations/0009_global_login_id_expand.sql"
ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION="$ROOT_DIR/packages/db/migrations/0011_account_provider_exact_dispatch.sql"
NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION="$ROOT_DIR/packages/db/migrations/0013_neon_definer_creator_membership.sql"
NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION="$ROOT_DIR/packages/db/migrations/0014_neon_definer_expand_compatibility.sql"
HOTEL_RELATIONSHIP_MIGRATION="$ROOT_DIR/packages/db/migrations/0016_hotel_relationship_management.sql"
HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION="$ROOT_DIR/packages/db/migrations/0017_hotel_relationship_integrity_hardening.sql"
HOTEL_SUPPORT_OVERLAP_MIGRATION="$ROOT_DIR/packages/db/migrations/0018_hotel_support_assignment_overlap.sql"
HOTEL_ROOM_MIGRATION="$ROOT_DIR/packages/db/migrations/0019_hotel_room_management.sql"
HOTEL_ROOM_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0022_hotel_room_contract_hardening.sql"
HOTEL_ROOM_LIFECYCLE_MIGRATION="$ROOT_DIR/packages/db/migrations/0025_hotel_room_reference_lifecycle.sql"
HOTEL_INSPECTION_PROCESS_MIGRATION="$ROOT_DIR/packages/db/migrations/0026_hotel_inspection_process_and_files.sql"
HOTEL_FILE_FINALIZER_RECOVERY_MIGRATION="$ROOT_DIR/packages/db/migrations/0027_hotel_file_finalizer_recovery.sql"
HOTEL_PROCESS_DEFAULT_READ_MIGRATION="$ROOT_DIR/packages/db/migrations/0028_hotel_process_default_read_contract.sql"
HOTEL_PROCESS_REVIEWER_CANDIDATES_MIGRATION="$ROOT_DIR/packages/db/migrations/0029_hotel_process_reviewer_candidates.sql"
HOTEL_INSPECTION_ROUTINE_MIGRATION="$ROOT_DIR/packages/db/migrations/0030_hotel_inspection_routine_contract.sql"
HOTEL_INSPECTION_EXECUTION_MIGRATION="$ROOT_DIR/packages/db/migrations/0031_hotel_inspection_execution_contract.sql"
HOTEL_INSPECTION_EVIDENCE_MIGRATION="$ROOT_DIR/packages/db/migrations/0032_hotel_inspection_evidence_processing.sql"
HOTEL_FILE_UPLOAD_SCOPE_MIGRATION="$ROOT_DIR/packages/db/migrations/0033_hotel_file_upload_scope.sql"
HOTEL_INSPECTION_EVIDENCE_SUBMISSION_MIGRATION="$ROOT_DIR/packages/db/migrations/0034_hotel_inspection_evidence_submission.sql"
HOTEL_INSPECTION_REVIEW_MIGRATION="$ROOT_DIR/packages/db/migrations/0035_hotel_inspection_review_and_file_view.sql"
HOTEL_FACILITY_MASTER_DATA_MIGRATION="$ROOT_DIR/packages/db/migrations/0036_hotel_facility_master_data.sql"
HOTEL_INSPECTION_TARGET_MIGRATION="$ROOT_DIR/packages/db/migrations/0037_hotel_inspection_execution_targets.sql"
HOTEL_INSPECTION_CHECKLIST_TARGET_MIGRATION="$ROOT_DIR/packages/db/migrations/0038_hotel_inspection_checklist_targets.sql"
HOTEL_INSPECTION_CHECKLIST_HARDENING_MIGRATION="$ROOT_DIR/packages/db/migrations/0039_hotel_inspection_checklist_v2_hardening.sql"
HOTEL_INSPECTION_FACILITY_EXECUTION_MIGRATION="$ROOT_DIR/packages/db/migrations/0040_hotel_inspection_facility_execution.sql"
HOTEL_INSPECTION_FACILITY_EXECUTION_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0041_hotel_inspection_facility_execution_contract.sql"
HOTEL_REPAIR_LIFECYCLE_MIGRATION="$ROOT_DIR/packages/db/migrations/0042_hotel_repair_lifecycle.sql"
HOTEL_CALENDAR_READ_MODEL_MIGRATION="$ROOT_DIR/packages/db/migrations/0043_hotel_calendar_read_model.sql"
GOOGLE_CALENDAR_PROJECTION_MIGRATION="$ROOT_DIR/packages/db/migrations/0044_google_calendar_projection.sql"
HOTEL_CALENDAR_READ_MODEL_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-calendar-read-model-integration.sql"
GOOGLE_CALENDAR_PROJECTION_TEST_SQL="$ROOT_DIR/packages/db/test/google-calendar-projection-integration.sql"
HOTEL_REPAIR_LIFECYCLE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-repair-lifecycle-integration.sql"
HOTEL_REPAIR_PRIVATE_EVIDENCE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-repair-private-evidence-integration.sql"
ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0012_account_provider_exact_dispatch_contract.sql"
NEON_DEFINER_CONTRACT_HARDENING_MIGRATION="$ROOT_DIR/packages/db/migrations/0015_neon_definer_contract_hardening.sql"
FALLBACK_REMOVAL_MIGRATION="$ROOT_DIR/packages/db/migrations/0008_remove_legacy_company_id_fallback.sql"
GLOBAL_LOGIN_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0010_global_login_id_contract.sql"
TEST_SQL="$ROOT_DIR/packages/db/test/foundation-integration.sql"
HOTEL_INSPECTION_PROCESS_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-process-integration.sql"
HOTEL_PROCESS_REVIEWER_CANDIDATES_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-process-reviewer-candidates-integration.sql"
HOTEL_INSPECTION_ROUTINE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-routine-integration.sql"
HOTEL_INSPECTION_EXECUTION_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-execution-integration.sql"
HOTEL_INSPECTION_TARGET_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-execution-targets-integration.sql"
HOTEL_INSPECTION_CHECKLIST_TARGET_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-checklist-targets-integration.sql"
HOTEL_INSPECTION_FACILITY_EXECUTION_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-facility-execution-integration.sql"
HOTEL_INSPECTION_EVIDENCE_SUBMISSION_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-evidence-submission-integration.sql"
HOTEL_INSPECTION_REVIEW_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-review-integration.sql"
HOTEL_INSPECTION_EVIDENCE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-evidence-integration.sql"
HOTEL_FILE_UPLOAD_SCOPE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-file-upload-scope-integration.sql"
HOTEL_FILE_FINALIZER_RECOVERY_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-file-finalizer-recovery-integration.sql"

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  if [[ "${ALLOW_DESTRUCTIVE_TEST_DATABASE:-}" != "1" ]]; then
    printf 'Refusing destructive integration test: explicit test-database opt-in is missing.\n' >&2
    exit 1
  fi
  DATABASE_NAME="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -c "select current_database()")"
  if [[ ! "$DATABASE_NAME" =~ (_test|_ci)($|_) ]]; then
    printf 'Refusing destructive integration test: database name is not test/CI scoped.\n' >&2
    exit 1
  fi
  cleanup_external_database() {
    local original_status="$?"
    local reset_status=0
    trap - EXIT
    set +e
    psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
      -c "drop schema if exists public cascade; create schema public" >/dev/null 2>&1
    reset_status="$?"
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$AUTH_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$CUSTOM_LOGIN_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$SESSION_DEFINER_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$TENANT_AUTHORITY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_EXPAND_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_SUPPORT_OVERLAP_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_CONTRACT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_LIFECYCLE_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_PROCESS_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_FINALIZER_RECOVERY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_PROCESS_DEFAULT_READ_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_PROCESS_REVIEWER_CANDIDATES_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_ROUTINE_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EXECUTION_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EVIDENCE_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_UPLOAD_SCOPE_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EVIDENCE_SUBMISSION_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_REVIEW_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FACILITY_MASTER_DATA_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_TARGET_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_CHECKLIST_TARGET_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_CHECKLIST_HARDENING_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_CONTRACT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_REPAIR_LIFECYCLE_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$original_status" -ne 0 ]]; then
      exit "$original_status"
    fi
    exit "$reset_status"
  }
  trap cleanup_external_database EXIT
  configure_test_database_timezone "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$AUTH_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$CUSTOM_LOGIN_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$SESSION_DEFINER_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$TENANT_AUTHORITY_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_EXPAND_MIGRATION" >/dev/null
  seed_legacy_compensation "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_SUPPORT_OVERLAP_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_MIGRATION" >/dev/null
  assert_expand_isolated "$TEST_DATABASE_URL"
  seed_legacy_compensation "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_CONTRACT_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_LIFECYCLE_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_PROCESS_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_FINALIZER_RECOVERY_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_PROCESS_DEFAULT_READ_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_PROCESS_REVIEWER_CANDIDATES_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_ROUTINE_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EXECUTION_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EVIDENCE_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_UPLOAD_SCOPE_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EVIDENCE_SUBMISSION_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_REVIEW_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FACILITY_MASTER_DATA_MIGRATION" >/dev/null
  assert_exact_contract_isolated "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null
  assert_legacy_auth_removed "$TEST_DATABASE_URL"
  PROBE_URL="$(configure_runtime_probe_role "$TEST_DATABASE_URL")"
  assert_inspection_runtime_acl "$PROBE_URL"
  register_owner_api_capability "$TEST_DATABASE_URL"
  RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$TEST_SQL")"
  if [[ "$RESULT" != *"PLATFORM_FOUNDATION_INTEGRATION_OK"* ]]; then
    printf '%s\n' "$RESULT" >&2
    exit 1
  fi
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const ready = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (ready.status !== "READY") throw new Error(`expected READY, received ${ready.status}`);
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "grant update (description) on public.inspection_item_results to gw_runtime_probe" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after inspection column ACL damage, received ${damaged.status}`);
}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "revoke update (description) on public.inspection_item_results from gw_runtime_probe" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const restored = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (restored.status !== "READY") {
  throw new Error(`expected READY after inspection column ACL repair, received ${restored.status}`);
}
NODE
  )
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/auth-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" TEST_PROBE_URL="$PROBE_URL" \
      pnpm exec tsx packages/db/test/account-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-room-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-facility-master-data-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx apps/api/test/hotel-room-api-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx apps/api/test/hotel-api-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-rls-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" TEST_PROBE_URL="$PROBE_URL" \
      pnpm exec tsx packages/db/test/hotel-readiness-damage-integration.ts
  )
  INSPECTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_PROCESS_TEST_SQL")"
  if [[ "$INSPECTION_RESULT" != *"INSPECTION_FILE_PROCESS_JOURNEY_OK"* ]]; then
    printf '%s\n' "$INSPECTION_RESULT" >&2
    exit 1
  fi
  EVIDENCE_SUBMISSION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EVIDENCE_SUBMISSION_TEST_SQL")"
  if [[ "$EVIDENCE_SUBMISSION_RESULT" != *"HOTEL_INSPECTION_EVIDENCE_SUBMISSION_OK"* ]]; then
    printf '%s\n' "$EVIDENCE_SUBMISSION_RESULT" >&2
    exit 1
  fi
  run_evidence_submit_concurrency_probe "$TEST_DATABASE_URL"
  RECOVERY_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_FINALIZER_RECOVERY_TEST_SQL")"
  if [[ "$RECOVERY_RESULT" != *"HOTEL_FILE_FINALIZER_RECOVERY_OK"* ]]; then
    printf '%s\n' "$RECOVERY_RESULT" >&2
    exit 1
  fi
  EXECUTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EXECUTION_TEST_SQL")"
  if [[ "$EXECUTION_RESULT" != *"HOTEL_INSPECTION_EXECUTION_OK"* ]]; then
    printf '%s\n' "$EXECUTION_RESULT" >&2
    exit 1
  fi
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_TARGET_MIGRATION" >/dev/null
  TARGET_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_TARGET_TEST_SQL")"
  if [[ "$TARGET_RESULT" != *"HOTEL_INSPECTION_TARGET_FOUNDATION_OK"* ]]; then
    printf '%s\n' "$TARGET_RESULT" >&2
    exit 1
  fi
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_CHECKLIST_TARGET_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_CHECKLIST_HARDENING_MIGRATION" >/dev/null
  grant_checklist_v2_api_capabilities "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_CONTRACT_MIGRATION" >/dev/null
  grant_facility_execution_capabilities "$TEST_DATABASE_URL"
  ROUTINE_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_ROUTINE_TEST_SQL")"
  if [[ "$ROUTINE_RESULT" != *"HOTEL_INSPECTION_ROUTINE_OK"* ]]; then
    printf '%s\n' "$ROUTINE_RESULT" >&2
    exit 1
  fi
  assert_room_constraints_exact "$TEST_DATABASE_URL" "$PROBE_URL"
  assert_room_fingerprint_damage "$TEST_DATABASE_URL" "$PROBE_URL"
  REVIEW_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_REVIEW_TEST_SQL")"
  if [[ "$REVIEW_RESULT" != *"HOTEL_INSPECTION_REVIEW_OK"* ]]; then
    printf '%s\n' "$REVIEW_RESULT" >&2
    exit 1
  fi
  run_review_transition_idempotency_concurrency_probe "$TEST_DATABASE_URL"
  assert_review_readiness_damage "$TEST_DATABASE_URL" "$PROBE_URL"
  assert_checklist_v2_readiness_damage "$TEST_DATABASE_URL" "$PROBE_URL"
  run_actual_inspection_api_probe "$TEST_DATABASE_URL"
  CHECKLIST_TARGET_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_CHECKLIST_TARGET_TEST_SQL")"
  if [[ "$CHECKLIST_TARGET_RESULT" != *"HOTEL_INSPECTION_CHECKLIST_TARGETS_OK"* ]]; then
    printf '%s\n' "$CHECKLIST_TARGET_RESULT" >&2
    exit 1
  fi
  FACILITY_EXECUTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_TEST_SQL")"
  if [[ "$FACILITY_EXECUTION_RESULT" != *"HOTEL_INSPECTION_FACILITY_EXECUTION_ACTUAL_OK"* ]]; then
    printf '%s\n' "$FACILITY_EXECUTION_RESULT" >&2
    exit 1
  fi
  run_actual_facility_inspection_api_probe "$TEST_DATABASE_URL"
  run_actual_scheduled_inspection_materializer_probe "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table schema_migrations rename column version to malformed_version" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const malformed = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (malformed.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after marker damage, received ${malformed.status}`);
}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table schema_migrations rename column malformed_version to version" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table audit_events disable trigger audit_events_no_update" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const disabledTrigger = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (disabledTrigger.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after trigger disable, received ${disabledTrigger.status}`);
}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table audit_events enable trigger audit_events_no_update" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -c "drop table roles cascade" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after required table drop, received ${damaged.status}`);
}
NODE
  )
  printf 'PLATFORM_FOUNDATION_INTEGRATION_OK\n'
  exit 0
fi

TMP_DIR="$(mktemp -d /tmp/werehere-hotel-pg.XXXXXX)"
DATA_DIR="$TMP_DIR/data"
SOCKET_DIR="$TMP_DIR/socket"
LOG_FILE="$TMP_DIR/postgres.log"
PORT="$((55000 + ($$ % 5000)))"

mkdir -p "$SOCKET_DIR"

cleanup() {
  if [[ -d "$DATA_DIR" ]]; then
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA_DIR" -A trust -U postgres --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" \
  -o "-F -k '$SOCKET_DIR' -p $PORT -c listen_addresses='127.0.0.1'" -w start >/dev/null

createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres werehere_hotel_test
createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres werehere_hotel_blank
configure_test_database_timezone "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
configure_test_database_timezone "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_blank"
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$AUTH_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$HOTEL_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$CUSTOM_LOGIN_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$SESSION_DEFINER_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$ACCOUNT_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$TENANT_AUTHORITY_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$GLOBAL_LOGIN_EXPAND_MIGRATION" >/dev/null
seed_legacy_compensation "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_RELATIONSHIP_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_SUPPORT_OVERLAP_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_ROOM_MIGRATION" >/dev/null
assert_expand_isolated "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
seed_legacy_compensation "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_ROOM_CONTRACT_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_ROOM_LIFECYCLE_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_INSPECTION_PROCESS_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_FILE_FINALIZER_RECOVERY_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_PROCESS_DEFAULT_READ_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_PROCESS_REVIEWER_CANDIDATES_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_INSPECTION_ROUTINE_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_INSPECTION_EXECUTION_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_INSPECTION_EVIDENCE_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_FILE_UPLOAD_SCOPE_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_INSPECTION_EVIDENCE_SUBMISSION_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_INSPECTION_REVIEW_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_FACILITY_MASTER_DATA_MIGRATION" >/dev/null
assert_exact_contract_isolated "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null
ADMIN_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
assert_legacy_auth_removed "$ADMIN_URL"
PROBE_URL="$(configure_runtime_probe_role "$ADMIN_URL")"
assert_inspection_runtime_acl "$PROBE_URL"
register_owner_api_capability "$ADMIN_URL"
RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$TEST_SQL")"

if [[ "$RESULT" != *"PLATFORM_FOUNDATION_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$RESULT" >&2
  exit 1
fi

(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
  TEST_ADMIN_URL="$ADMIN_URL" \
  TEST_BLANK_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_blank" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const ready = await probeDatabaseReadiness(process.env.TEST_READY_URL);
const unsafeOwner = await probeDatabaseReadiness(process.env.TEST_ADMIN_URL);
const blank = await probeDatabaseReadiness(process.env.TEST_BLANK_URL);
const missing = await probeDatabaseReadiness(undefined);

if (ready.status !== "READY") throw new Error(`expected READY, received ${ready.status}`);
if (unsafeOwner.status !== "SCHEMA_NOT_READY") throw new Error(`expected privileged owner rejection, received ${unsafeOwner.status}`);
if (blank.status !== "SCHEMA_NOT_READY") throw new Error(`expected SCHEMA_NOT_READY, received ${blank.status}`);
if (missing.status !== "NOT_CONFIGURED") throw new Error(`expected NOT_CONFIGURED, received ${missing.status}`);
NODE
)

(
  cd "$ROOT_DIR"
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/auth-repository-integration.ts
  TEST_READY_URL="$ADMIN_URL" TEST_PROBE_URL="$PROBE_URL" \
    pnpm exec tsx packages/db/test/account-repository-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-repository-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-room-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-facility-master-data-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx apps/api/test/hotel-room-api-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx apps/api/test/hotel-api-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-rls-integration.ts
  TEST_READY_URL="$ADMIN_URL" TEST_PROBE_URL="$PROBE_URL" \
    pnpm exec tsx packages/db/test/hotel-readiness-damage-integration.ts
)
INSPECTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_PROCESS_TEST_SQL")"
if [[ "$INSPECTION_RESULT" != *"INSPECTION_FILE_PROCESS_JOURNEY_OK"* ]]; then
  printf '%s\n' "$INSPECTION_RESULT" >&2
  exit 1
fi
EVIDENCE_SUBMISSION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_EVIDENCE_SUBMISSION_TEST_SQL")"
if [[ "$EVIDENCE_SUBMISSION_RESULT" != *"HOTEL_INSPECTION_EVIDENCE_SUBMISSION_OK"* ]]; then
  printf '%s\n' "$EVIDENCE_SUBMISSION_RESULT" >&2
  exit 1
fi
run_evidence_submit_concurrency_probe "$ADMIN_URL"
REVIEWER_CANDIDATES_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_PROCESS_REVIEWER_CANDIDATES_TEST_SQL")"
if [[ "$REVIEWER_CANDIDATES_RESULT" != *"HOTEL_PROCESS_REVIEWER_CANDIDATES_OK"* ]]; then
  printf '%s\n' "$REVIEWER_CANDIDATES_RESULT" >&2
  exit 1
fi
RECOVERY_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_FILE_FINALIZER_RECOVERY_TEST_SQL")"
if [[ "$RECOVERY_RESULT" != *"HOTEL_FILE_FINALIZER_RECOVERY_OK"* ]]; then
  printf '%s\n' "$RECOVERY_RESULT" >&2
  exit 1
fi
EXECUTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_EXECUTION_TEST_SQL")"
if [[ "$EXECUTION_RESULT" != *"HOTEL_INSPECTION_EXECUTION_OK"* ]]; then
  printf '%s\n' "$EXECUTION_RESULT" >&2
  exit 1
fi

run_target_preflight_failure_probe() {
  local mode="$1"
  local suffix="1"
  if [[ "$mode" == "conflict" ]]; then suffix="2"; fi
  local clone_name="werehere_target_${mode}_test"
  local clone_url="postgres://postgres@127.0.0.1:$PORT/$clone_name"
  dropdb -h 127.0.0.1 -p "$PORT" -U postgres --if-exists "$clone_name"
  createdb -h 127.0.0.1 -p "$PORT" -U postgres \
    --template werehere_hotel_test "$clone_name"
  psql -X -v ON_ERROR_STOP=1 -d "$clone_url" >/dev/null <<SQL
with sample as (
  select * from public.process_executions order by created_at,id limit 1
)
insert into public.process_executions (
  id,company_id,branch_id,application_type,resource_id,definition_id,
  revision_id,state,version,created_by
)
select '7ad00000-0000-4000-8000-00000000000${suffix}'::uuid,
       company_id,branch_id,application_type,
       '7ae00000-0000-4000-8000-00000000000${suffix}'::uuid,
       definition_id,revision_id,'PENDING_INPUT',1,created_by
  from sample;
with sample as (
  select * from public.hotel_inspections order by created_at,id limit 1
)
insert into public.hotel_inspections (
  id,company_id,branch_id,source,business_date,due_at,status,
  process_execution_id,version,created_by
)
select '7ae00000-0000-4000-8000-00000000000${suffix}'::uuid,
       company_id,branch_id,'MANUAL',business_date,due_at,'PENDING_INPUT',
       '7ad00000-0000-4000-8000-00000000000${suffix}'::uuid,
       1,created_by
  from sample;
SQL
  if [[ "$mode" == "conflict" ]]; then
    psql -X -v ON_ERROR_STOP=1 -d "$clone_url" >/dev/null <<'SQL'
with sample as (
  select * from public.inspection_item_snapshots order by created_at,id limit 1
)
insert into public.inspection_item_snapshots (
  id,company_id,branch_id,inspection_id,room_id,source_item_id,
  checklist_revision_id,name,description,is_required,display_order,
  default_severity
)
select '7af00000-0000-4000-8000-000000000001',company_id,branch_id,
       '7ae00000-0000-4000-8000-000000000002',room_id,
       '7af10000-0000-4000-8000-000000000001',checklist_revision_id,
       name,description,is_required,display_order,default_severity
  from sample;
with sample as (
  select * from public.inspection_item_snapshots
   where id='7af00000-0000-4000-8000-000000000001'
)
insert into public.inspection_item_snapshots (
  id,company_id,branch_id,inspection_id,room_id,source_item_id,
  checklist_revision_id,name,description,is_required,display_order,
  default_severity
)
select '7af00000-0000-4000-8000-000000000002',company_id,branch_id,
       inspection_id,room_id,'7af10000-0000-4000-8000-000000000002',
       checklist_revision_id,name,description,is_required,display_order,
       default_severity
  from sample;
alter table public.inspection_item_snapshots
  disable trigger inspection_item_snapshots_append_only;
update public.inspection_item_snapshots
   set room_number_snapshot=room_number_snapshot || '-conflict'
 where id='7af00000-0000-4000-8000-000000000002';
alter table public.inspection_item_snapshots
  enable trigger inspection_item_snapshots_append_only;
SQL
  fi
  set +e
  local migration_log
  migration_log="$(psql -X -v ON_ERROR_STOP=1 -d "$clone_url" \
    -f "$HOTEL_INSPECTION_TARGET_MIGRATION" 2>&1)"
  local migration_status="$?"
  set -e
  local expected_message='inspection target backfill requires at least one item'
  if [[ "$mode" == "conflict" ]]; then
    expected_message='inspection target backfill snapshot conflict'
  fi
  if [[ "$migration_status" -eq 0 ]] ||
     ! grep -Fq "$expected_message" <<<"$migration_log"; then
    printf '%s\n' "$migration_log" >&2
    printf 'Target %s preflight did not fail safely.\n' "$mode" >&2
    exit 1
  fi
  local rollback_state
  rollback_state="$(psql -X -v ON_ERROR_STOP=1 -At -d "$clone_url" -c \
    "select (to_regclass('public.inspection_execution_targets') is null)::integer || ':' || count(*) from public.schema_migrations where version='0037_hotel_inspection_execution_targets'")"
  if [[ "$rollback_state" != "1:0" ]]; then
    printf 'Target %s preflight left partial schema state: %s\n' \
      "$mode" "$rollback_state" >&2
    exit 1
  fi
  dropdb -h 127.0.0.1 -p "$PORT" -U postgres "$clone_name"
}

run_target_preflight_failure_probe zero
run_target_preflight_failure_probe conflict
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" >/dev/null <<'SQL'
do $$ begin
  if not exists (
    select 1 from pg_roles where rolname='werehere_target_default_acl_test'
  ) then
    create role werehere_target_default_acl_test noinherit;
  end if;
end $$;
alter default privileges in schema public
  grant select on tables to werehere_target_default_acl_test;
alter default privileges in schema public
  grant execute on functions to werehere_target_default_acl_test;
SQL
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_TARGET_MIGRATION" >/dev/null
TARGET_DEFAULT_ACL_COUNT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -c "select (select count(*) from pg_class target_table cross join lateral aclexplode(coalesce(target_table.relacl,acldefault('r'::\"char\",target_table.relowner))) target_acl join pg_roles target_role on target_role.oid=target_acl.grantee where target_table.oid='public.inspection_execution_targets'::regclass and target_role.rolname='werehere_target_default_acl_test') + (select count(*) from pg_proc capture_function cross join lateral aclexplode(coalesce(capture_function.proacl,acldefault('f'::\"char\",capture_function.proowner))) capture_acl join pg_roles capture_role on capture_role.oid=capture_acl.grantee where capture_function.oid='public.inspection_item_execution_target_capture_v1()'::regprocedure and capture_role.rolname='werehere_target_default_acl_test')")"
if [[ "$TARGET_DEFAULT_ACL_COUNT" != "0" ]]; then
  printf 'Target migration retained unexpected default ACLs: %s\n' \
    "$TARGET_DEFAULT_ACL_COUNT" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" >/dev/null <<'SQL'
alter default privileges in schema public
  revoke select on tables from werehere_target_default_acl_test;
alter default privileges in schema public
  revoke execute on functions from werehere_target_default_acl_test;
drop role werehere_target_default_acl_test;
SQL
printf '%s\n' 'HOTEL_INSPECTION_TARGET_DEFAULT_ACL_OK'
TARGET_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_TARGET_TEST_SQL")"
if [[ "$TARGET_RESULT" != *"HOTEL_INSPECTION_TARGET_FOUNDATION_OK"* ]]; then
  printf '%s\n' "$TARGET_RESULT" >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" >/dev/null <<'SQL'
with sample as (
  select * from public.process_executions order by created_at,id limit 1
)
insert into public.process_executions (
  id,company_id,branch_id,application_type,resource_id,definition_id,
  revision_id,state,version,created_by
)
select '7b100000-0000-4000-8000-000000000001',company_id,branch_id,
       application_type,'7b200000-0000-4000-8000-000000000001',
       definition_id,revision_id,'PENDING_INPUT',1,created_by
  from sample;
with sample as (
  select * from public.hotel_inspections order by created_at,id limit 1
)
insert into public.hotel_inspections (
  id,company_id,branch_id,source,business_date,due_at,status,
  process_execution_id,version,created_by
)
select '7b200000-0000-4000-8000-000000000001',company_id,branch_id,
       'MANUAL',business_date,due_at,'PENDING_INPUT',
       '7b100000-0000-4000-8000-000000000001',1,created_by
  from sample;
SQL
TARGET_CONCURRENCY_LOG_A="$(mktemp)"
TARGET_CONCURRENCY_LOG_B="$(mktemp)"
insert_concurrent_target_item() {
  local item_id="$1"
  local room_id="$2"
  local log_file="$3"
  psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" >"$log_file" 2>&1 <<SQL
with sample as (
  select * from public.inspection_item_snapshots order by created_at,id limit 1
)
insert into public.inspection_item_snapshots (
  id,company_id,branch_id,inspection_id,room_id,source_item_id,
  checklist_revision_id,name,description,is_required,display_order,
  default_severity
)
select '$item_id',company_id,branch_id,
       '7b200000-0000-4000-8000-000000000001','$room_id'::uuid,
       '$item_id'::uuid,checklist_revision_id,name,description,
       is_required,display_order,default_severity
  from sample;
SQL
}
TARGET_CONCURRENCY_ROOM="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -c \
  'select room_id from public.inspection_item_snapshots order by created_at,id limit 1')"
insert_concurrent_target_item \
  '7b300000-0000-4000-8000-000000000001' "$TARGET_CONCURRENCY_ROOM" \
  "$TARGET_CONCURRENCY_LOG_A" &
TARGET_PID_A=$!
insert_concurrent_target_item \
  '7b300000-0000-4000-8000-000000000002' "$TARGET_CONCURRENCY_ROOM" \
  "$TARGET_CONCURRENCY_LOG_B" &
TARGET_PID_B=$!
TARGET_STATUS_A=0
TARGET_STATUS_B=0
wait "$TARGET_PID_A" || TARGET_STATUS_A=$?
wait "$TARGET_PID_B" || TARGET_STATUS_B=$?
if [[ "$TARGET_STATUS_A" -ne 0 || "$TARGET_STATUS_B" -ne 0 ]]; then
  sed -e 's/postgresql:\/\/[^ ]*/[REDACTED]/g' "$TARGET_CONCURRENCY_LOG_A" >&2
  sed -e 's/postgresql:\/\/[^ ]*/[REDACTED]/g' "$TARGET_CONCURRENCY_LOG_B" >&2
  rm -f "$TARGET_CONCURRENCY_LOG_A" "$TARGET_CONCURRENCY_LOG_B"
  exit 1
fi
rm -f "$TARGET_CONCURRENCY_LOG_A" "$TARGET_CONCURRENCY_LOG_B"
TARGET_CONVERGENCE="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -c \
  "select count(distinct item.execution_target_id) || ':' || count(distinct target.id) from public.inspection_item_snapshots item join public.inspection_execution_targets target on target.company_id=item.company_id and target.id=item.execution_target_id where item.inspection_id='7b200000-0000-4000-8000-000000000001'")"
if [[ "$TARGET_CONVERGENCE" != "1:1" ]]; then
  printf 'Concurrent target capture did not converge: %s\n' \
    "$TARGET_CONVERGENCE" >&2
  exit 1
fi
printf '%s\n' 'HOTEL_INSPECTION_TARGET_CONCURRENCY_OK'

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_CHECKLIST_TARGET_MIGRATION" >/dev/null
grant_checklist_v2_api_capabilities "$ADMIN_URL"
assert_checklist_expand_readiness_damage "$ADMIN_URL" "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_CHECKLIST_HARDENING_MIGRATION" >/dev/null
grant_checklist_v2_api_capabilities "$ADMIN_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_MIGRATION" >/dev/null
grant_facility_execution_capabilities "$ADMIN_URL"
assert_schema_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_CONTRACT_MIGRATION" >/dev/null
assert_schema_ready "$PROBE_URL"

EVIDENCE_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_EVIDENCE_TEST_SQL")"
if [[ "$EVIDENCE_RESULT" != *"HOTEL_INSPECTION_EVIDENCE_PROCESSING_OK"* ]]; then
  printf '%s\n' "$EVIDENCE_RESULT" >&2
  exit 1
fi
UPLOAD_SCOPE_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_FILE_UPLOAD_SCOPE_TEST_SQL")"
if [[ "$UPLOAD_SCOPE_RESULT" != *"HOTEL_FILE_UPLOAD_SCOPE_OK"* ]]; then
  printf '%s\n' "$UPLOAD_SCOPE_RESULT" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "delete from public.schema_migrations where version = '0032_hotel_inspection_evidence_processing'" >/dev/null
assert_schema_not_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "insert into public.schema_migrations(version) values ('0032_hotel_inspection_evidence_processing')" >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "alter table public.hotel_file_links rename constraint hotel_file_links_version_result_revision_key to damaged_evidence_revision_key" >/dev/null
assert_schema_not_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "alter table public.hotel_file_links rename constraint damaged_evidence_revision_key to hotel_file_links_version_result_revision_key" >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "alter trigger hotel_file_links_parent_guard on public.hotel_file_links rename to damaged_file_links_parent_guard" >/dev/null
assert_schema_not_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "alter trigger damaged_file_links_parent_guard on public.hotel_file_links rename to hotel_file_links_parent_guard" >/dev/null


psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "revoke execute on function public.hotel_file_scan_candidates_v1(integer) from gw_runtime_probe" >/dev/null
assert_schema_not_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
  -c "grant execute on function public.hotel_file_scan_candidates_v1(integer) to gw_runtime_probe" >/dev/null
ROUTINE_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_ROUTINE_TEST_SQL")"
if [[ "$ROUTINE_RESULT" != *"HOTEL_INSPECTION_ROUTINE_OK"* ]]; then
  printf '%s\n' "$ROUTINE_RESULT" >&2
  exit 1
fi
assert_room_constraints_exact "$ADMIN_URL" "$PROBE_URL"
assert_room_fingerprint_damage "$ADMIN_URL" "$PROBE_URL"
REVIEW_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_REVIEW_TEST_SQL")"
if [[ "$REVIEW_RESULT" != *"HOTEL_INSPECTION_REVIEW_OK"* ]]; then
  printf '%s\n' "$REVIEW_RESULT" >&2
  exit 1
fi
run_review_transition_idempotency_concurrency_probe "$ADMIN_URL"
assert_review_readiness_damage "$ADMIN_URL" "$PROBE_URL"
assert_checklist_v2_readiness_damage "$ADMIN_URL" "$PROBE_URL"
run_actual_inspection_api_probe "$ADMIN_URL"
CHECKLIST_TARGET_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_CHECKLIST_TARGET_TEST_SQL")"
if [[ "$CHECKLIST_TARGET_RESULT" != *"HOTEL_INSPECTION_CHECKLIST_TARGETS_OK"* ]]; then
  printf '%s\n' "$CHECKLIST_TARGET_RESULT" >&2
  exit 1
fi
FACILITY_EXECUTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_FACILITY_EXECUTION_TEST_SQL")"
if [[ "$FACILITY_EXECUTION_RESULT" != *"HOTEL_INSPECTION_FACILITY_EXECUTION_ACTUAL_OK"* ]]; then
  printf '%s\n' "$FACILITY_EXECUTION_RESULT" >&2
  exit 1
fi
run_actual_facility_inspection_api_probe "$ADMIN_URL"
run_actual_scheduled_inspection_materializer_probe "$ADMIN_URL"

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table schema_migrations rename column version to malformed_version" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const malformed = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (malformed.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after marker damage, received ${malformed.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table schema_migrations rename column malformed_version to version" >/dev/null

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table outbox_jobs drop constraint outbox_jobs_compensation_linkage_check" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after exact dispatch constraint drop, received ${damaged.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test >/dev/null <<'SQL'
alter table outbox_jobs
  add constraint outbox_jobs_compensation_linkage_check check (
    job_type <> 'ACCOUNT_PROVIDER_COMPENSATE'
    or status = 'PENDING'
    or status in ('SUCCEEDED', 'CANCELLED', 'DEAD_LETTER')
    or coalesce((
      pg_catalog.jsonb_typeof(payload->'provisioningAttemptId') = 'string'
      and payload->>'provisioningAttemptId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and pg_catalog.jsonb_typeof(payload->'originalErrorCode') = 'string'
      and payload->>'originalErrorCode' in (
        'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
      )
    ), false)
  );
SQL
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const weakened = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (weakened.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY for weakened exact dispatch constraint, received ${weakened.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table outbox_jobs drop constraint outbox_jobs_compensation_linkage_check" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test >/dev/null <<'SQL'
alter table outbox_jobs
  add constraint outbox_jobs_compensation_linkage_check check (
    job_type <> 'ACCOUNT_PROVIDER_COMPENSATE'
    or status in ('SUCCEEDED', 'CANCELLED', 'DEAD_LETTER')
    or coalesce((
      pg_catalog.jsonb_typeof(payload->'provisioningAttemptId') = 'string'
      and payload->>'provisioningAttemptId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and pg_catalog.jsonb_typeof(payload->'originalErrorCode') = 'string'
      and payload->>'originalErrorCode' in (
        'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
      )
      and pg_catalog.jsonb_typeof(payload->'userId') = 'string'
      and payload->>'userId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and pg_catalog.jsonb_typeof(payload->'providerSubject') = 'string'
      and length(payload->>'providerSubject') between 1 and 200
      and payload->>'action' = 'COMPENSATE'
    ), false)
  );
SQL

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table audit_events disable trigger audit_events_no_update" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const disabledTrigger = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (disabledTrigger.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after trigger disable, received ${disabledTrigger.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table audit_events enable trigger audit_events_no_update" >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_REPAIR_LIFECYCLE_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_CALENDAR_READ_MODEL_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$GOOGLE_CALENDAR_PROJECTION_MIGRATION" >/dev/null
grant_repair_lifecycle_capabilities "$ADMIN_URL"
grant_google_calendar_reconciler_capabilities "$ADMIN_URL"
run_actual_scheduled_reconciler_drain_barrier_probe "$ADMIN_URL" "$PROBE_URL"
assert_google_calendar_projection_readiness_damage "$ADMIN_URL" "$PROBE_URL"
assert_schema_ready "$PROBE_URL"
run_actual_repair_api_probe "$ADMIN_URL"
run_actual_calendar_api_probe "$ADMIN_URL"
run_actual_google_calendar_projection_probe "$ADMIN_URL" "$PROBE_URL"
REPAIR_PRIVATE_EVIDENCE_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_REPAIR_PRIVATE_EVIDENCE_TEST_SQL")"
if [[ "$REPAIR_PRIVATE_EVIDENCE_RESULT" != *"HOTEL_REPAIR_PRIVATE_EVIDENCE_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$REPAIR_PRIVATE_EVIDENCE_RESULT" >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "drop table roles cascade" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after required table drop, received ${damaged.status}`);
}
NODE
)

printf 'PLATFORM_FOUNDATION_INTEGRATION_OK\n'
