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
  end loop;
  if to_regprocedure('public.scheduled_reconciler_invocation_enter_v1()') is not null then
    for capability_role in select role_name from public.runtime_database_capabilities where capability='RECONCILER'
    loop
      execute format('grant execute on function public.scheduled_reconciler_invocation_enter_v1() to %I', capability_role.role_name);
      execute format('grant execute on function public.scheduled_reconciler_invocation_exit_v1() to %I', capability_role.role_name);
      execute format('grant execute on function public.scheduled_reconciler_drain_barrier_v1() to %I', capability_role.role_name);
    end loop;
  end if;
end
$grant_repair_lifecycle$;
SQL
}

assert_scheduled_reconciler_lock_runtime() {
  local probe_url="$1"
  local result
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$probe_url" <<'SQL'
begin;
select public.scheduled_reconciler_invocation_enter_v1();
select public.scheduled_reconciler_invocation_exit_v1();
select public.scheduled_reconciler_drain_barrier_v1();
commit;
select 'SCHEDULED_RECONCILER_LOCK_RUNTIME_OK';
SQL
)"
  if [[ "$result" != *"SCHEDULED_RECONCILER_LOCK_RUNTIME_OK"* ]]; then
    printf '%s\n' "$result" >&2
    return 1
  fi
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
GOOGLE_CALENDAR_REMOVAL_MIGRATION="$ROOT_DIR/packages/db/migrations/0045_remove_google_calendar_projection.sql"
SCHEDULED_RECONCILER_LOCK_MIGRATION="$ROOT_DIR/packages/db/migrations/0046_scheduled_reconciler_invocation_lock.sql"
GOOGLE_CALENDAR_REMOVAL_TEST_SQL="$ROOT_DIR/packages/db/test/google-calendar-removal-integration.sql"
GOOGLE_CALENDAR_DECOMMISSION_SCRIPT="$ROOT_DIR/scripts/decommission-google-calendar-preview.mjs"
HOTEL_CALENDAR_READ_MODEL_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-calendar-read-model-integration.sql"
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
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$SCHEDULED_RECONCILER_LOCK_MIGRATION" >/dev/null
grant_repair_lifecycle_capabilities "$ADMIN_URL"
assert_schema_ready "$PROBE_URL"
assert_scheduled_reconciler_lock_runtime "$PROBE_URL"
run_actual_repair_api_probe "$ADMIN_URL"
run_actual_calendar_api_probe "$ADMIN_URL"
REPAIR_PRIVATE_EVIDENCE_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_REPAIR_PRIVATE_EVIDENCE_TEST_SQL")"
if [[ "$REPAIR_PRIVATE_EVIDENCE_RESULT" != *"HOTEL_REPAIR_PRIVATE_EVIDENCE_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$REPAIR_PRIVATE_EVIDENCE_RESULT" >&2
  exit 1
fi

LEGACY_REMOVAL_DATABASE="werehere_legacy_calendar_removal_test"
dropdb -h "$SOCKET_DIR" -p "$PORT" -U postgres --if-exists "$LEGACY_REMOVAL_DATABASE"
createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  --template werehere_hotel_test "$LEGACY_REMOVAL_DATABASE"
LEGACY_REMOVAL_ADMIN_URL="postgres://postgres@127.0.0.1:$PORT/$LEGACY_REMOVAL_DATABASE"
LEGACY_REMOVAL_PROBE_URL="$(node -e \
  "const u=new URL(process.argv[1]);u.pathname='/' + process.argv[2];console.log(u.toString())" \
  "$PROBE_URL" "$LEGACY_REMOVAL_DATABASE")"
psql -X -v ON_ERROR_STOP=1 -d "$LEGACY_REMOVAL_ADMIN_URL" \
  -f "$GOOGLE_CALENDAR_REMOVAL_MIGRATION" >/dev/null
grant_repair_lifecycle_capabilities "$LEGACY_REMOVAL_ADMIN_URL"
assert_schema_ready "$LEGACY_REMOVAL_PROBE_URL"
assert_scheduled_reconciler_lock_runtime "$LEGACY_REMOVAL_PROBE_URL"
run_actual_calendar_api_probe "$LEGACY_REMOVAL_ADMIN_URL"
dropdb -h "$SOCKET_DIR" -p "$PORT" -U postgres "$LEGACY_REMOVAL_DATABASE"
printf 'GOOGLE_CALENDAR_LEGACY_REMOVAL_ACTUAL_OK\n'

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" <<'SQL' >/dev/null
drop function public.scheduled_reconciler_drain_barrier_v1();
drop function public.scheduled_reconciler_invocation_exit_v1();
drop function public.scheduled_reconciler_invocation_enter_v1();
delete from public.schema_migrations
 where version = '0046_scheduled_reconciler_invocation_lock';
SQL
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$GOOGLE_CALENDAR_PROJECTION_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$SCHEDULED_RECONCILER_LOCK_MIGRATION" >/dev/null
grant_repair_lifecycle_capabilities "$ADMIN_URL"
assert_schema_ready "$PROBE_URL"
assert_scheduled_reconciler_lock_runtime "$PROBE_URL"
run_actual_calendar_api_probe "$ADMIN_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" <<'SQL' >/dev/null
insert into public.calendar_connections(id, company_id, status, created_by)
select '4c000000-0000-4000-8000-000000000001'::uuid,
       company_record.id,
       'DISCONNECTED',
       user_record.id
  from public.companies company_record
  join public.users user_record on user_record.company_id = company_record.id
 order by company_record.id, user_record.id
 limit 1;
SQL
set +e
GOOGLE_CALENDAR_DISPOSITION_OUTPUT="$(
  psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" \
    -f "$GOOGLE_CALENDAR_REMOVAL_MIGRATION" 2>&1
)"
GOOGLE_CALENDAR_DISPOSITION_STATUS="$?"
set -e
if [[ "$GOOGLE_CALENDAR_DISPOSITION_STATUS" -eq 0 ]] ||
   [[ "$GOOGLE_CALENDAR_DISPOSITION_OUTPUT" != *"GOOGLE_CALENDAR_DISPOSITION_REQUIRED"* ]]; then
  printf '%s\n' "$GOOGLE_CALENDAR_DISPOSITION_OUTPUT" >&2
  exit 1
fi
GOOGLE_CALENDAR_DISPOSITION_STATE="$(
  psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -c \
    "select concat_ws('|',
       (select count(*) from public.schema_migrations where version='0045_remove_google_calendar_projection'),
       pg_catalog.to_regclass('public.calendar_connections')::text,
       (select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname='calendar_projection_visit_signal')
     )"
)"
if [[ "$GOOGLE_CALENDAR_DISPOSITION_STATE" != "0|calendar_connections|1" ]]; then
  printf 'unsafe disposition rollback state: %s\n' "$GOOGLE_CALENDAR_DISPOSITION_STATE" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -c \
  "delete from public.calendar_connections where id='4c000000-0000-4000-8000-000000000001'::uuid" >/dev/null
printf 'GOOGLE_CALENDAR_DISPOSITION_PREFLIGHT_OK\n'
GOOGLE_CALENDAR_TEST_KEYRING="$(
  node -e "process.stdout.write(JSON.stringify({'1':Buffer.alloc(32).toString('base64url')}))"
)"
GOOGLE_CALENDAR_DECOMMISSION_OUTPUT="$(
  DATABASE_URL_PREVIEW="$ADMIN_URL" \
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID="foundation-test-client" \
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET="foundation-test-secret" \
  CALENDAR_CREDENTIAL_AES_KEYRING_JSON="$GOOGLE_CALENDAR_TEST_KEYRING" \
    node --input-type=module - "$GOOGLE_CALENDAR_DECOMMISSION_SCRIPT" <<'NODE'
const modulePath = process.argv[2];
const subject = await import(new URL(`file://${modulePath}`).href);
try {
  const result = await subject.runPreviewGoogleDecommission({
    databaseUrl: process.env.DATABASE_URL_PREVIEW,
    clientId: process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET,
    keyring: subject.parseAesKeyring(
      process.env.CALENDAR_CREDENTIAL_AES_KEYRING_JSON,
    ),
  });
  process.stdout.write(
    `PREVIEW_GOOGLE_PROVIDER_DISPOSITION_OK calendars=${result.deletedCalendarCount} credentials=${result.revokedCredentialCount}`,
  );
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "NO_CODE";
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  process.stderr.write(`FOUNDATION_DECOMMISSION_ERROR ${code} ${message}\n`);
  process.exitCode = 1;
}
NODE
)"
unset GOOGLE_CALENDAR_TEST_KEYRING
if [[ "$GOOGLE_CALENDAR_DECOMMISSION_OUTPUT" != \
      "PREVIEW_GOOGLE_PROVIDER_DISPOSITION_OK calendars=0 credentials=0" ]]; then
  printf '%s\n' "$GOOGLE_CALENDAR_DECOMMISSION_OUTPUT" >&2
  exit 1
fi
GOOGLE_CALENDAR_RETIRED_RETRY_OUTPUT="$(
  DATABASE_URL_PREVIEW="$ADMIN_URL" \
    env -u GOOGLE_CALENDAR_OAUTH_CLIENT_ID \
      -u GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET \
      -u CALENDAR_CREDENTIAL_AES_KEYRING_JSON \
      node "$GOOGLE_CALENDAR_DECOMMISSION_SCRIPT"
)"
if [[ "$GOOGLE_CALENDAR_RETIRED_RETRY_OUTPUT" != \
      "PREVIEW_GOOGLE_PROVIDER_DISPOSITION_OK calendars=0 credentials=0" ]]; then
  printf '%s\n' "$GOOGLE_CALENDAR_RETIRED_RETRY_OUTPUT" >&2
  exit 1
fi
printf 'GOOGLE_CALENDAR_DECOMMISSION_ACTUAL_OK\n'
printf 'GOOGLE_CALENDAR_RETIRED_ENV_RETRY_ACTUAL_OK\n'
grant_repair_lifecycle_capabilities "$ADMIN_URL"
assert_schema_ready "$PROBE_URL"
assert_scheduled_reconciler_lock_runtime "$PROBE_URL"
run_actual_calendar_api_probe "$ADMIN_URL"
GOOGLE_CALENDAR_REMOVAL_RESULT="$(
  psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$GOOGLE_CALENDAR_REMOVAL_TEST_SQL"
)"
if [[ "$GOOGLE_CALENDAR_REMOVAL_RESULT" != *"GOOGLE_CALENDAR_REMOVAL_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$GOOGLE_CALENDAR_REMOVAL_RESULT" >&2
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
