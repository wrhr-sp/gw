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
  hotel_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_file_upload_scope_v1(uuid,uuid,text)
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
      )
    elif [[ "$constraint_name" == "hotel_rooms_company_branch_id_key" ]]; then
      dependent_specifications=(
        "hotel_room_status_history:hotel_room_status_history_room_hotel_fkey"
        "inspection_item_snapshots:inspection_item_snapshots_company_id_branch_id_room_id_fkey"
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
ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0012_account_provider_exact_dispatch_contract.sql"
NEON_DEFINER_CONTRACT_HARDENING_MIGRATION="$ROOT_DIR/packages/db/migrations/0015_neon_definer_contract_hardening.sql"
FALLBACK_REMOVAL_MIGRATION="$ROOT_DIR/packages/db/migrations/0008_remove_legacy_company_id_fallback.sql"
GLOBAL_LOGIN_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0010_global_login_id_contract.sql"
TEST_SQL="$ROOT_DIR/packages/db/test/foundation-integration.sql"
HOTEL_INSPECTION_PROCESS_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-process-integration.sql"
HOTEL_PROCESS_REVIEWER_CANDIDATES_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-process-reviewer-candidates-integration.sql"
HOTEL_INSPECTION_ROUTINE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-routine-integration.sql"
HOTEL_INSPECTION_EXECUTION_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-execution-integration.sql"
HOTEL_INSPECTION_EVIDENCE_SUBMISSION_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-inspection-evidence-submission-integration.sql"
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
  run_actual_inspection_api_probe "$TEST_DATABASE_URL"
  EXECUTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_EXECUTION_TEST_SQL")"
  if [[ "$EXECUTION_RESULT" != *"HOTEL_INSPECTION_EXECUTION_OK"* ]]; then
    printf '%s\n' "$EXECUTION_RESULT" >&2
    exit 1
  fi
  ROUTINE_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$HOTEL_INSPECTION_ROUTINE_TEST_SQL")"
  if [[ "$ROUTINE_RESULT" != *"HOTEL_INSPECTION_ROUTINE_OK"* ]]; then
    printf '%s\n' "$ROUTINE_RESULT" >&2
    exit 1
  fi
  assert_room_constraints_exact "$TEST_DATABASE_URL" "$PROBE_URL"
  assert_room_fingerprint_damage "$TEST_DATABASE_URL" "$PROBE_URL"
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
run_actual_inspection_api_probe "$ADMIN_URL"
EXECUTION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_INSPECTION_EXECUTION_TEST_SQL")"
if [[ "$EXECUTION_RESULT" != *"HOTEL_INSPECTION_EXECUTION_OK"* ]]; then
  printf '%s\n' "$EXECUTION_RESULT" >&2
  exit 1
fi
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
