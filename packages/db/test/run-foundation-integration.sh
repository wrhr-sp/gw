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

grant_global_api_probe_table_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
GRANT SELECT ON TABLE
  account_provisioning_attempts,auth_credential_rate_limits,auth_identities,auth_login_transactions,auth_sessions,
  branches,companies,hotel_owner_assignments,hotel_profiles,hotel_room_status_history,hotel_room_types,hotel_rooms,
  hotel_staff_assignments,housekeeping_hotel_links,idempotency_records,initial_password_change_attempts,login_id_registry,
  outbox_jobs,permission_grants,permissions,roles,runtime_database_capabilities,schema_migrations,user_group_memberships,
  user_groups,user_role_memberships,users,hotel_file_finalizer_capabilities,hotel_file_scanner_agent_capabilities,
  hotel_file_links,hotel_file_uploads,hotel_file_versions,hotel_inspections,hotel_process_defaults,
  inspection_checklist_item_exclusions,inspection_checklist_items,inspection_checklist_revisions,
  inspection_item_result_history,inspection_item_results,inspection_routine_revisions,inspection_routine_rounds,
  inspection_routines,process_definition_revisions,process_definitions,process_execution_history,process_executions,
  process_stage_snapshots,process_transition_snapshots,hotel_common_areas,hotel_facility_types,hotel_facilities,
  hotel_common_area_history,hotel_facility_type_history,hotel_facility_history
TO gw_api_probe;
GRANT INSERT ON TABLE account_provisioning_attempts,audit_events,auth_credential_rate_limits,auth_identities,
  auth_login_transactions,branches,hotel_owner_assignments,hotel_profiles,hotel_room_types,hotel_staff_assignments,
  housekeeping_hotel_links,idempotency_records,initial_password_change_attempts,login_id_registry,outbox_jobs,users
TO gw_api_probe;
GRANT UPDATE ON TABLE account_provisioning_attempts,auth_credential_rate_limits,auth_login_transactions,
  idempotency_records,initial_password_change_attempts,outbox_jobs,users TO gw_api_probe;
GRANT DELETE ON TABLE auth_credential_rate_limits,auth_login_transactions,idempotency_records TO gw_api_probe;
GRANT UPDATE(updated_at) ON TABLE auth_identities,branches TO gw_api_probe;
GRANT UPDATE(updated_at,version) ON TABLE hotel_profiles TO gw_api_probe;
GRANT UPDATE(display_order,is_active,name,updated_at,updated_by,version) ON TABLE hotel_room_types TO gw_api_probe;
GRANT UPDATE(end_date,terminated_at,terminated_by,termination_reason,updated_at,version) ON TABLE
  hotel_owner_assignments,hotel_staff_assignments,housekeeping_hotel_links TO gw_api_probe;
SQL
}

grant_global_api_probe_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
GRANT EXECUTE ON FUNCTION
  hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid),
  hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid),
  hotel_facility_reference_command_v1(uuid,uuid,text,text,uuid,integer,jsonb,text,uuid,uuid,uuid,text,text,text,text,text,uuid),
  auth_create_session_v2(uuid,bytea,text,integer,integer,timestamptz,uuid),
  auth_resolve_login_identity_v1(text),
  auth_resolve_principal_v2(bytea,integer),
  auth_revoke_session_v2(bytea,text,uuid),
  auth_revoke_hotel_owner_sessions_v1(uuid,uuid),
  auth_revoke_user_sessions_v1(uuid,uuid,text),
  runtime_is_schema_owner(),
  runtime_has_capability(text),
  api_current_company_id(),
  reconciler_current_company_id()
  TO gw_api_probe;
SQL
}

grant_inquiry_api_probe_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
GRANT EXECUTE ON FUNCTION
  hotel_inquiry_capabilities_v1(uuid,text),
  hotel_inquiry_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_inquiry_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_inquiry_file_scope_v1(uuid,uuid,text),
  hotel_inquiry_file_view_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid),
  hotel_inquiry_read_v1(uuid,uuid,uuid,jsonb,text),
  hotel_notification_command_v1(uuid,uuid,text,integer,text,uuid,text,text,text,text,uuid,uuid),
  hotel_notification_read_v1(uuid,jsonb,text)
  TO gw_api_probe;
SQL
}

grant_knowledge_api_probe_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
GRANT EXECUTE ON FUNCTION
  hotel_knowledge_capabilities_v1(uuid,text),
  hotel_knowledge_reviewer_candidates_v1(uuid,uuid,text),
  hotel_knowledge_read_v1(uuid,uuid,jsonb,text),
  hotel_knowledge_command_v1(uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_knowledge_feedback_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_knowledge_file_parent_scope_v1(uuid,uuid,text),
  hotel_knowledge_file_scope_v1(uuid,uuid,text),
  hotel_knowledge_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_knowledge_attachment_command_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_knowledge_file_view_v1(uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid)
  TO gw_api_probe;
SQL
}

grant_knowledge_core_api_probe_capabilities() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
GRANT EXECUTE ON FUNCTION
  hotel_knowledge_capabilities_v1(uuid,text),
  hotel_knowledge_reviewer_candidates_v1(uuid,uuid,text),
  hotel_knowledge_read_v1(uuid,uuid,jsonb,text),
  hotel_knowledge_command_v1(uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),
  hotel_knowledge_feedback_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)
  TO gw_api_probe;
SQL
}

cleanup_api_probe_role() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
DO $cleanup_scanner_capability$
BEGIN
  IF to_regclass('public.hotel_file_scanner_agent_capabilities') IS NOT NULL THEN
    DELETE FROM public.hotel_file_scanner_agent_capabilities
    WHERE role_name = 'gw_api_probe';
  END IF;
END
$cleanup_scanner_capability$;
DELETE FROM runtime_database_capabilities WHERE role_name = 'gw_api_probe';
DROP OWNED BY gw_api_probe;
DROP ROLE IF EXISTS gw_api_probe;
SQL
}

run_hotel_knowledge_bank_integration() {
  local admin_url="$1" api_url="$2" reconciler_url="$3" direct_status result
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $setup$
declare c uuid:='10000000-0000-0000-0000-000000000001';h uuid:='50000000-0000-4000-8000-000000000001';internal_id uuid;reviewer_id uuid:='6b130000-0000-4000-8000-000000000001';designated_id uuid:='6b170000-0000-4000-8000-000000000001';owner_id uuid;unassigned_id uuid:='6b100000-0000-4000-8000-000000000001';p text;
begin
 select user_id into strict internal_id from public.auth_sessions where id='4f000000-0000-4000-8000-000000000001';select user_id into strict owner_id from public.auth_sessions where id='d9230000-0000-4000-8000-000000000001';
 insert into public.users(id,company_id,user_type,display_name)values(reviewer_id,c,'INTERNAL_STAFF','지식 일반 검토자');insert into public.auth_identities(id,company_id,user_id,provider,provider_subject)values('6b140000-0000-4000-8000-000000000001',c,reviewer_id,'ZITADEL','knowledge-reviewer');insert into public.auth_sessions(id,company_id,user_id,identity_id,token_hash,idle_expires_at,absolute_expires_at,auth_time,authentication_method)values('6b150000-0000-4000-8000-000000000001',c,reviewer_id,'6b140000-0000-4000-8000-000000000001',sha256(convert_to((repeat('K',42)||'R'),'UTF8')),statement_timestamp()+interval'30 minutes',statement_timestamp()+interval'8 hours',statement_timestamp(),'OIDC_PKCE');insert into public.hotel_staff_assignments(id,company_id,branch_id,user_id,assignment_type,start_date,reason,created_by)values('6b160000-0000-4000-8000-000000000001',c,h,reviewer_id,'PRIMARY',statement_timestamp()::date,'지식 독립 검토',internal_id);
 foreach p in array array['KNOWLEDGE_READ','KNOWLEDGE_CREATE']loop insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)values(gen_random_uuid(),c,h,'USER',internal_id,p,'ALLOW',statement_timestamp()-interval'1 day',internal_id,'지식 actual author');end loop;
 foreach p in array array['KNOWLEDGE_READ','KNOWLEDGE_REVIEW','KNOWLEDGE_PUBLISH','KNOWLEDGE_ARCHIVE']loop insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)values(gen_random_uuid(),c,h,'USER',reviewer_id,p,'ALLOW',statement_timestamp()-interval'1 day',internal_id,'지식 actual reviewer');end loop;
 insert into public.users(id,company_id,user_type,display_name)values(designated_id,c,'INTERNAL_STAFF','지식 지정 검토자');insert into public.auth_identities(id,company_id,user_id,provider,provider_subject)values('6b180000-0000-4000-8000-000000000001',c,designated_id,'ZITADEL','knowledge-designated-reviewer');insert into public.auth_sessions(id,company_id,user_id,identity_id,token_hash,idle_expires_at,absolute_expires_at,auth_time,authentication_method)values('6b190000-0000-4000-8000-000000000001',c,designated_id,'6b180000-0000-4000-8000-000000000001',sha256(convert_to((repeat('D',42)||'R'),'UTF8')),statement_timestamp()+interval'30 minutes',statement_timestamp()+interval'8 hours',statement_timestamp(),'OIDC_PKCE');insert into public.hotel_staff_assignments(id,company_id,branch_id,user_id,assignment_type,start_date,reason,created_by)values('6b1a0000-0000-4000-8000-000000000001',c,h,designated_id,'PRIMARY',statement_timestamp()::date,'지식 지정 검토',internal_id);
 foreach p in array array['KNOWLEDGE_READ','KNOWLEDGE_REVIEW','KNOWLEDGE_PUBLISH','KNOWLEDGE_HIGH_RISK_PUBLISH','KNOWLEDGE_ARCHIVE']loop insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)values(gen_random_uuid(),c,h,'USER',designated_id,p,'ALLOW',statement_timestamp()-interval'1 day',internal_id,'지식 지정 검토자');end loop;
 insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)values(gen_random_uuid(),c,h,'USER',owner_id,'KNOWLEDGE_READ','ALLOW',statement_timestamp()-interval'1 day',internal_id,'deny 우선'),(gen_random_uuid(),c,h,'USER',owner_id,'KNOWLEDGE_READ','DENY',statement_timestamp()-interval'1 day',internal_id,'explicit deny');
 insert into public.users(id,company_id,user_type,display_name)values(unassigned_id,c,'INTERNAL_STAFF','미배정 지식 조회자');insert into public.auth_identities(id,company_id,user_id,provider,provider_subject)values('6b110000-0000-4000-8000-000000000001',c,unassigned_id,'ZITADEL','knowledge-unassigned');insert into public.auth_sessions(id,company_id,user_id,identity_id,token_hash,idle_expires_at,absolute_expires_at,auth_time,authentication_method)values('6b120000-0000-4000-8000-000000000001',c,unassigned_id,'6b110000-0000-4000-8000-000000000001',sha256(convert_to(repeat('U',43),'UTF8')),statement_timestamp()+interval'30 minutes',statement_timestamp()+interval'8 hours',statement_timestamp(),'OIDC_PKCE');insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)values(gen_random_uuid(),c,h,'USER',unassigned_id,'KNOWLEDGE_READ','ALLOW',statement_timestamp()-interval'1 day',internal_id,'미배정 사용자');
end $setup$;
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $journey$
declare c uuid:='10000000-0000-0000-0000-000000000001';h uuid:='50000000-0000-4000-8000-000000000001';k uuid:='6b200000-0000-4000-8000-000000000001';k_priv uuid:='6b240000-0000-4000-8000-000000000001';k_reviewer uuid:='6b250000-0000-4000-8000-000000000001';k_scope uuid:='6b260000-0000-4000-8000-000000000001';k_related uuid:='6b270000-0000-4000-8000-000000000001';r record;content jsonb;v integer;first_snapshot jsonb;search_term text;canonical_branch uuid;
begin
 perform set_config('app.company_id',c::text,true);perform set_config('TimeZone','Asia/Seoul',true);perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
 select*into r from public.hotel_knowledge_capabilities_v1(c,repeat('I',43));if r.command_status<>'OK'or not(r.result_snapshot->>'canCreate')::boolean or jsonb_array_length(r.result_snapshot->'hotels')<1 then raise exception'author capabilities failed: %',r.command_status;end if;
 content:=jsonb_build_object('scopeType','HOTEL','hotelId',h,'title','에어컨 냉방 저하 확인 순서','summary','전문업체 호출 전에 안전하게 확인할 항목입니다.','knowledgeType','FACILITY_MAINTENANCE','riskClassification','STANDARD','designatedReviewerUserId',null,'situation','객실 에어컨을 켰지만 냉방이 약한 상황','symptomsAndContext','송풍은 되지만 실내 온도가 내려가지 않습니다.','checks',jsonb_build_array('설정 온도와 운전 모드를 확인합니다.','흡입구가 막히지 않았는지 확인합니다.'),'recommendedResponse',jsonb_build_array('안전하게 전원을 끄고 필터 상태를 확인합니다.'),'prohibitedOrCautionResponse',jsonb_build_array('전기 덮개를 임의로 분해하지 않습니다.'),'escalationCriteria','누전 냄새나 과열이 있으면 즉시 관리자에게 보고합니다.','requiredPermissionOrApproval','객실 판매중지는 관리자 승인이 필요합니다.','caseSummary','필터 막힘으로 냉방이 약했던 사례','outcomeAndLesson','월별 필터 점검으로 재발을 줄였습니다.','tags',jsonb_build_array('에어컨','냉방'),'relatedManualRefs',jsonb_build_array('시설 안전 매뉴얼 3장'),'relatedIssueIds','[]'::jsonb,'relatedRepairIds','[]'::jsonb,'reviewDueAt','2027-02-21T00:00:00.000Z');
 select*into r from public.hotel_knowledge_command_v1(c,k,'CREATE',0,content,repeat('I',43),gen_random_uuid(),'knowledge-create','POST','/api/knowledge','create-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'CREATED'or r.result_snapshot->>'status'<>'DRAFT'then raise exception'create failed: %',r.command_status;end if;first_snapshot:=r.result_snapshot;
 select branch_id into canonical_branch from public.hotel_knowledge_file_parent_scope_v1(c,k,repeat('I',43));if canonical_branch is distinct from h then raise exception'canonical hotel attachment scope failed: %',canonical_branch;end if;
 select*into r from public.hotel_knowledge_command_v1(c,k,'CREATE',0,content,repeat('I',43),gen_random_uuid(),'knowledge-create','POST','/api/knowledge','create-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'REPLAYED'or r.result_snapshot<>first_snapshot then raise exception'create replay failed: %',r.command_status;end if;
 perform set_config('app.session_id','6b150000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_read_v1(c,k,'{}',(repeat('K',42)||'R'));if r.command_status<>'NOT_FOUND'then raise exception'draft leaked: %',r.command_status;end if;
 perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'REQUEST_REVIEW',1,jsonb_build_object('reason','현장 검토를 요청합니다.'),repeat('I',43),gen_random_uuid(),'knowledge-review-request','POST','/api/knowledge/'||k||'/transitions','review-request-hash',gen_random_uuid(),gen_random_uuid());v:=(r.result_snapshot->>'version')::integer;
 select*into r from public.hotel_knowledge_command_v1(c,k,'PUBLISH',v,jsonb_build_object('reason','작성자 자체 게시 시도'),repeat('I',43),gen_random_uuid(),'knowledge-self-publish','POST','/api/knowledge/'||k||'/transitions','self-publish-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'FORBIDDEN'then raise exception'self review accepted: %',r.command_status;end if;
 perform set_config('app.session_id','6b150000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'PUBLISH',v,jsonb_build_object('reason','안전 기준과 대응순서를 검토했습니다.'),(repeat('K',42)||'R'),gen_random_uuid(),'knowledge-publish','POST','/api/knowledge/'||k||'/transitions','publish-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'or r.result_snapshot->>'status'<>'PUBLISHED'or not(r.result_snapshot->'actions'->>'canMarkNeedsReview')::boolean then raise exception'publish/action projection failed: %',r.command_status;end if;v:=(r.result_snapshot->>'version')::integer;
 perform set_config('app.session_id','6b150000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'MARK_NEEDS_REVIEW',1,jsonb_build_object('reason','이전 version으로 재검토 전환을 시도합니다.'),(repeat('K',42)||'R'),gen_random_uuid(),'knowledge-stale','POST','/api/knowledge/'||k||'/transitions','stale-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'VERSION_CONFLICT'then raise exception'stale accepted: %',r.command_status;end if;
 perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
 select*into r from public.hotel_knowledge_read_v1(c,null,jsonb_build_object('search','냉방','page',1,'pageSize',20),repeat('I',43));if r.command_status<>'OK'or not exists(select 1 from jsonb_array_elements(r.result_snapshot->'entries')x where x->>'id'=k::text)or exists(select 1 from jsonb_array_elements(r.result_snapshot->'entries')x where x?'history'or x?'links'or x?'situation')then raise exception'search/summary failed: % %',r.command_status,r.result_snapshot;end if;
 foreach search_term in array array['운전 모드','안전하게 전원을','임의로 분해']loop select*into r from public.hotel_knowledge_read_v1(c,null,jsonb_build_object('search',search_term,'page',1,'pageSize',20),repeat('I',43));if r.command_status<>'OK'or not exists(select 1 from jsonb_array_elements(r.result_snapshot->'entries')x where x->>'id'=k::text)then raise exception'response body search failed for %: % %',search_term,r.command_status,r.result_snapshot;end if;end loop;
 select*into r from public.hotel_knowledge_read_v1('6bf00000-0000-4000-8000-000000000001',k,'{}',repeat('I',43));if r.command_status<>'FORBIDDEN'then raise exception'cross-company accepted: %',r.command_status;end if;
 perform set_config('app.session_id','d9230000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_read_v1(c,k,'{}',repeat('O',43));if r.command_status<>'NOT_FOUND'then raise exception'explicit deny lost: %',r.command_status;end if;
 perform set_config('app.session_id','6b120000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_read_v1(c,k,'{}',repeat('U',43));if r.command_status<>'NOT_FOUND'then raise exception'unassigned read accepted: %',r.command_status;end if;
 perform set_config('app.session_id','6b150000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'MARK_NEEDS_REVIEW',v,jsonb_build_object('reason','현장 절차 변경으로 재검토가 필요합니다.'),(repeat('K',42)||'R'),gen_random_uuid(),'knowledge-stale-mark','POST','/api/knowledge/'||k||'/transitions','stale-mark-hash',gen_random_uuid(),gen_random_uuid());v:=(r.result_snapshot->>'version')::integer;
 perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);content:=content||jsonb_build_object('title','객실 에어컨 냉방 필터 확인 절차','reason','현장 필터 확인순서를 보완합니다.');select*into r from public.hotel_knowledge_command_v1(c,k,'UPDATE',v,content,repeat('I',43),gen_random_uuid(),'knowledge-update','PATCH','/api/knowledge/'||k,'update-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'then raise exception'update failed: %',r.command_status;end if;v:=(r.result_snapshot->>'version')::integer;
 perform set_config('app.session_id','6b150000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'REPUBLISH',v,jsonb_build_object('reason','보완된 현장 절차를 재검토했습니다.'),(repeat('K',42)||'R'),gen_random_uuid(),'knowledge-republish','POST','/api/knowledge/'||k||'/transitions','republish-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'then raise exception'republish failed: %',r.command_status;end if;v:=(r.result_snapshot->>'version')::integer;
 perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_feedback_v1(c,k,v,jsonb_build_object('kind','HELPFUL','comment',null),repeat('I',43),gen_random_uuid(),'knowledge-helpful','POST','/api/knowledge/'||k||'/feedback','helpful-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'RECORDED'then raise exception'feedback failed: %',r.command_status;end if;first_snapshot:=r.result_snapshot;
 select*into r from public.hotel_knowledge_feedback_v1(c,k,v,jsonb_build_object('kind','HELPFUL','comment',null),repeat('I',43),gen_random_uuid(),'knowledge-helpful','POST','/api/knowledge/'||k||'/feedback','helpful-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'REPLAYED'or r.result_snapshot<>first_snapshot then raise exception'feedback replay failed: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_feedback_v1(c,k,v,jsonb_build_object('kind','NOT_HELPFUL','comment',null),repeat('I',43),gen_random_uuid(),'knowledge-opposite','POST','/api/knowledge/'||k||'/feedback','opposite-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'VALIDATION_ERROR'then raise exception'opposite vote accepted: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_feedback_v1(c,k,v,jsonb_build_object('kind','REPORT_ERROR','comment','다음 검토에서 필터 교체주기를 다시 확인해 주세요.'),repeat('I',43),gen_random_uuid(),'knowledge-report','POST','/api/knowledge/'||k||'/feedback','report-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'RECORDED'then raise exception'report failed: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_read_v1(c,k,'{}',repeat('I',43));if r.command_status<>'OK'or r.result_snapshot->>'status'<>'PUBLISHED'or jsonb_array_length(r.result_snapshot->'history')<>6 or(r.result_snapshot->>'helpfulCount')::integer<>1 then raise exception'detail/history failed: % %',r.command_status,r.result_snapshot;end if;
 perform set_config('app.session_id','6b150000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'PUBLISH',v,jsonb_build_object('reason','이미 게시된 상태에서 다시 게시 시도'),(repeat('K',42)||'R'),gen_random_uuid(),'knowledge-invalid-state','POST','/api/knowledge/'||k||'/transitions','invalid-state-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'INVALID_STATE_TRANSITION'then raise exception'invalid publish state accepted: %',r.command_status;end if;
 perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'UPDATE',v,content||jsonb_build_object('reason','게시된 글 수정 시도'),repeat('I',43),gen_random_uuid(),'knowledge-update-published','PATCH','/api/knowledge/'||k,'update-published-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'FORBIDDEN'then raise exception'published update accepted: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_command_v1(c,k_priv,'CREATE',0,content||jsonb_build_object('summary','연락처 test@example.com 포함'),repeat('I',43),gen_random_uuid(),'knowledge-privacy-denied','POST','/api/knowledge','privacy-denied-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'KNOWLEDGE_PERSONAL_DATA_DETECTED'then raise exception'private content accepted: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_command_v1(c,k_reviewer,'CREATE',0,content||jsonb_build_object('riskClassification','SAFETY','designatedReviewerUserId',null),repeat('I',43),gen_random_uuid(),'knowledge-reviewer-denied','POST','/api/knowledge','reviewer-denied-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'VALIDATION_ERROR'then raise exception'invalid high-risk reviewer accepted: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_command_v1(c,k_scope,'CREATE',0,content||jsonb_build_object('scopeType','COMPANY','hotelId',h),repeat('I',43),gen_random_uuid(),'knowledge-scope-denied','POST','/api/knowledge','scope-denied-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'VALIDATION_ERROR'then raise exception'invalid scope accepted: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_command_v1(c,k_related,'CREATE',0,content||jsonb_build_object('relatedIssueIds',jsonb_build_array('6b280000-0000-4000-8000-000000000001')),repeat('I',43),gen_random_uuid(),'knowledge-related-denied','POST','/api/knowledge','related-denied-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'NOT_FOUND'then raise exception'invalid related resource accepted: %',r.command_status;end if;
end $journey$;
select 'HOTEL_KNOWLEDGE_BANK_API_JOURNEY_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_BANK_API_JOURNEY_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $audit_assert$
declare c uuid:='10000000-0000-0000-0000-000000000001';k uuid:='6b200000-0000-4000-8000-000000000001';k_priv uuid:='6b240000-0000-4000-8000-000000000001';k_reviewer uuid:='6b250000-0000-4000-8000-000000000001';k_scope uuid:='6b260000-0000-4000-8000-000000000001';k_related uuid:='6b270000-0000-4000-8000-000000000001';
begin
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k and event_code='KNOWLEDGE_SELF_PUBLISH_DENIED' and result='DENIED')then raise exception'self publish denial audit missing';end if;
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k and event_code='KNOWLEDGE_READ_DENIED' and result='DENIED')then raise exception'hidden detail denial audit missing';end if;
 if(select count(*)from public.audit_events where company_id=c and resource_id=k and event_code='KNOWLEDGE_STATE_REJECTED'and result='DENIED')<2 then raise exception'state denial audits missing';end if;
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k_priv and event_code='KNOWLEDGE_CONTENT_REJECTED'and result='DENIED')then raise exception'privacy denial audit missing';end if;
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k_reviewer and event_code='KNOWLEDGE_REVIEWER_REJECTED'and result='DENIED')then raise exception'reviewer denial audit missing';end if;
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k_scope and event_code='KNOWLEDGE_SCOPE_REJECTED'and result='DENIED')then raise exception'scope denial audit missing';end if;
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k_related and event_code='KNOWLEDGE_RELATED_RESOURCE_REJECTED'and result='DENIED')then raise exception'related resource denial audit missing';end if;
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k and event_code='KNOWLEDGE_FEEDBACK_DUPLICATE_REJECTED'and result='DENIED'and after_summary='{}'::jsonb)then raise exception'duplicate feedback denial audit missing';end if;
 if exists(select 1 from public.audit_events where company_id=c and resource_id in(k,k_priv,k_reviewer,k_scope,k_related)and result='DENIED'and(after_summary<>'{}'::jsonb or coalesce(reason,'')~*'(에어컨|냉방 저하|test@example|opaque|token|session)'))then raise exception'failure audit leaked content or credential material';end if;
end $audit_assert$;
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $high_risk_create$
declare c uuid:='10000000-0000-0000-0000-000000000001';h uuid:='50000000-0000-4000-8000-000000000001';k uuid:='6b230000-0000-4000-8000-000000000001';r record;content jsonb;v integer;
begin
 perform set_config('app.company_id',c::text,true);perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
 content:=jsonb_build_object('scopeType','HOTEL','hotelId',h,'title','감전 위험 객실 설비 대응','summary','고위험 안전 지식 게시 권한 actual 검증','knowledgeType','SAFETY_CAUTION','riskClassification','SAFETY','designatedReviewerUserId','6b170000-0000-4000-8000-000000000001','situation','감전 위험 상황','symptomsAndContext','전기 설비 이상','checks',jsonb_build_array('차단기를 확인합니다.'),'recommendedResponse',jsonb_build_array('현장을 통제합니다.'),'prohibitedOrCautionResponse',jsonb_build_array('임의 분해를 금지합니다.'),'escalationCriteria','즉시 관리자에게 보고','requiredPermissionOrApproval','지정 검토자 승인','caseSummary','','outcomeAndLesson','','tags',jsonb_build_array('안전'),'relatedManualRefs','[]'::jsonb,'relatedIssueIds','[]'::jsonb,'relatedRepairIds','[]'::jsonb,'reviewDueAt','2027-02-21T00:00:00.000Z');
 select*into r from public.hotel_knowledge_command_v1(c,k,'CREATE',0,content,repeat('I',43),gen_random_uuid(),'high-create','POST','/api/knowledge','high-create-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'CREATED'then raise exception'high risk create failed: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_command_v1(c,k,'REQUEST_REVIEW',1,jsonb_build_object('reason','고위험 검토 요청'),repeat('I',43),gen_random_uuid(),'high-review','POST','/api/knowledge/'||k||'/transitions','high-review-hash',gen_random_uuid(),gen_random_uuid());v:=(r.result_snapshot->>'version')::integer;
 perform set_config('app.session_id','6b150000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_read_v1(c,k,'{}',(repeat('K',42)||'R'));if r.command_status<>'OK'or(r.result_snapshot->'actions'->>'canPublish')::boolean then raise exception'ordinary reviewer action projection allowed high risk publish';end if;
 select*into r from public.hotel_knowledge_command_v1(c,k,'PUBLISH',v,jsonb_build_object('reason','일반 검토자 고위험 게시 시도'),(repeat('K',42)||'R'),gen_random_uuid(),'high-publish-denied','POST','/api/knowledge/'||k||'/transitions','high-publish-denied-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'FORBIDDEN'then raise exception'ordinary reviewer published high risk: %',r.command_status;end if;
end $high_risk_create$;
select 'HOTEL_KNOWLEDGE_HIGH_RISK_DENIED_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_HIGH_RISK_DENIED_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $high_grant$
declare c uuid:='10000000-0000-0000-0000-000000000001';h uuid:='50000000-0000-4000-8000-000000000001';k uuid:='6b230000-0000-4000-8000-000000000001';reviewer uuid:='6b130000-0000-4000-8000-000000000001';grantor uuid;
begin
 select user_id into strict grantor from public.auth_sessions where id='4f000000-0000-4000-8000-000000000001';
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=k and event_code='KNOWLEDGE_HIGH_RISK_PUBLISH_DENIED'and result='DENIED'and after_summary='{}'::jsonb)then raise exception'high risk denial audit missing';end if;
 if not exists(select 1 from public.hotel_knowledge_entries where company_id=c and id=k and designated_reviewer_user_id='6b170000-0000-4000-8000-000000000001' and review_requested_version=2)then raise exception'designated reviewer/version binding missing';end if;
end $high_grant$;
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $high_publish$
declare c uuid:='10000000-0000-0000-0000-000000000001';k uuid:='6b230000-0000-4000-8000-000000000001';r record;v integer;
begin
 perform set_config('app.company_id',c::text,true);perform set_config('app.session_id','6b190000-0000-4000-8000-000000000001',true);
 select*into r from public.hotel_knowledge_read_v1(c,k,'{}',(repeat('D',42)||'R'));if r.command_status<>'OK'or not(r.result_snapshot->'actions'->>'canPublish')::boolean then raise exception'designated reviewer action projection missing';end if;v:=(r.result_snapshot->>'version')::integer;
 select*into r from public.hotel_knowledge_command_v1(c,k,'PUBLISH',v,jsonb_build_object('reason','지정 검토자 안전 검토 완료'),(repeat('D',42)||'R'),gen_random_uuid(),'high-publish-allowed','POST','/api/knowledge/'||k||'/transitions','high-publish-allowed-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'then raise exception'designated reviewer high risk publish failed: %',r.command_status;end if;v:=(r.result_snapshot->>'version')::integer;
 select*into r from public.hotel_knowledge_command_v1(c,k,'MARK_NEEDS_REVIEW',v,jsonb_build_object('reason','고위험 재검토 actual'),(repeat('D',42)||'R'),gen_random_uuid(),'high-mark-review','POST','/api/knowledge/'||k||'/transitions','high-mark-review-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'then raise exception'high risk mark review failed: %',r.command_status;end if;v:=(r.result_snapshot->>'version')::integer;
 perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_command_v1(c,k,'REQUEST_REVIEW',v,jsonb_build_object('reason','고위험 재검토를 다시 요청합니다.'),repeat('I',43),gen_random_uuid(),'high-rereview','POST','/api/knowledge/'||k||'/transitions','high-rereview-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'or r.result_snapshot->>'status'<>'REVIEW_REQUESTED'then raise exception'high risk re-review request failed: %',r.command_status;end if;
end $high_publish$;
select 'HOTEL_KNOWLEDGE_HIGH_RISK_ALLOWED_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_HIGH_RISK_ALLOWED_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
select gen_random_uuid(),'10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001','USER','6b170000-0000-4000-8000-000000000001','KNOWLEDGE_HIGH_RISK_PUBLISH','DENY',statement_timestamp()-interval'1 day',user_id,'고위험 지정 검토자 explicit deny actual'from public.auth_sessions where id='4f000000-0000-4000-8000-000000000001';
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $high_deny$
declare c uuid:='10000000-0000-0000-0000-000000000001';k uuid:='6b230000-0000-4000-8000-000000000001';r record;v integer;
begin
 perform set_config('app.company_id',c::text,true);perform set_config('app.session_id','6b190000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_read_v1(c,k,'{}',(repeat('D',42)||'R'));if r.command_status<>'OK'then raise exception'high risk detail unavailable before explicit deny test';end if;v:=(r.result_snapshot->>'version')::integer;
 select*into r from public.hotel_knowledge_command_v1(c,k,'PUBLISH',v,jsonb_build_object('reason','explicit deny 우회 시도'),(repeat('D',42)||'R'),gen_random_uuid(),'high-republish-denied','POST','/api/knowledge/'||k||'/transitions','high-republish-denied-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'FORBIDDEN'then raise exception'explicit deny lost for high risk: %',r.command_status;end if;
end $high_deny$;
select 'HOTEL_KNOWLEDGE_HIGH_RISK_EXPLICIT_DENY_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_HIGH_RISK_EXPLICIT_DENY_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "update public.hotel_knowledge_entries set review_due_at=statement_timestamp()-interval'1 day' where company_id='10000000-0000-0000-0000-000000000001' and id='6b200000-0000-4000-8000-000000000001' and status='PUBLISHED'" >/dev/null
  direct_status="$(psql -X -At -d "$api_url" -c "select public.hotel_knowledge_reconcile_due_v1(100)" 2>&1 || true)"
  [[ "$direct_status" == *"permission denied"* ]] || { printf 'knowledge reconciler execute ACL failed: %s\n' "$direct_status" >&2; return 1; }
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$reconciler_url" -c "select public.hotel_knowledge_reconcile_due_v1(100)")"
  [[ "$result" == "1" ]] || { printf 'knowledge due reconcile expected 1, received %s\n' "$result" >&2; return 1; }
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$reconciler_url" -c "select public.hotel_knowledge_reconcile_due_v1(100)")"
  [[ "$result" == "0" ]] || { printf 'knowledge due reconcile replay expected 0, received %s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $reconcile_assert$
declare c uuid:='10000000-0000-0000-0000-000000000001';k uuid:='6b200000-0000-4000-8000-000000000001';
begin
 if not exists(select 1 from public.hotel_knowledge_entries where company_id=c and id=k and status='NEEDS_REVIEW')then raise exception'knowledge canonical due transition missing';end if;
 if(select count(*)from public.hotel_knowledge_versions where company_id=c and knowledge_id=k and action='AUTO_NEEDS_REVIEW'and status='NEEDS_REVIEW'and actor_user_id is null)<>1 then raise exception'knowledge auto review immutable history invalid';end if;
 if(select count(*)from public.audit_events where company_id=c and resource_id=k and event_code='KNOWLEDGE_AUTO_NEEDS_REVIEW'and actor_type='SYSTEM'and actor_user_id is null and result='SUCCEEDED')<>1 then raise exception'knowledge auto review system audit invalid';end if;
end $reconcile_assert$;
SQL
  printf 'HOTEL_KNOWLEDGE_DUE_RECONCILER_ACTUAL_OK\n'
  psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
with actor as (
  select company_id, user_id
  from public.auth_sessions
  where id = '4f000000-0000-4000-8000-000000000001'
)
insert into public.permission_grants(
  id, company_id, branch_id, subject_type, subject_id,
  permission_code, effect, valid_from, granted_by, reason
)
select
  gen_random_uuid(), actor.company_id, null, 'USER', actor.user_id,
  permission_code, 'ALLOW', clock_timestamp() - interval '1 day', actor.user_id,
  '회사 공통 지식 첨부 actual 작성자'
from actor
cross join (values ('KNOWLEDGE_READ'), ('KNOWLEDGE_CREATE')) permissions(permission_code);
insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id)
select '6b3a0000-0000-4000-8000-000000000001', 'KNOWLEDGE_FILE_AUDIT_COLLISION_FIXTURE', user_id, 'INTERNAL_STAFF', id, company_id, '50000000-0000-4000-8000-000000000001', 'KNOWLEDGE_ENTRY', '6b210000-0000-4000-8000-000000000001', '{}'::jsonb, 'SUCCEEDED', '6b3a0000-0000-4000-8000-000000000002'
from public.auth_sessions where id='4f000000-0000-4000-8000-000000000001';
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $attachment_prepare$
declare c uuid:='10000000-0000-0000-0000-000000000001';h uuid:='50000000-0000-4000-8000-000000000001';kh uuid:='6b210000-0000-4000-8000-000000000001';kc uuid:='6b220000-0000-4000-8000-000000000001';uh uuid:='6b300000-0000-4000-8000-000000000001';uc uuid:='6b301000-0000-4000-8000-000000000001';ue uuid:='6b302000-0000-4000-8000-000000000001';sh uuid:='6b320000-0000-4000-8000-000000000001';sc uuid:='6b321000-0000-4000-8000-000000000001';r record;base jsonb;
begin
 perform set_config('app.company_id',c::text,true);perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
 base:=jsonb_build_object('title','첨부 actual 지식','summary','private 첨부 actual 검증 자료입니다.','knowledgeType','FACILITY_MAINTENANCE','riskClassification','STANDARD','designatedReviewerUserId',null,'situation','첨부 actual 상황','symptomsAndContext','첨부 actual 맥락','checks',jsonb_build_array('첨부를 확인합니다.'),'recommendedResponse',jsonb_build_array('승인된 첨부만 사용합니다.'),'prohibitedOrCautionResponse',jsonb_build_array('외부 공개 URL을 만들지 않습니다.'),'escalationCriteria','검역 실패 시 관리자에게 보고합니다.','requiredPermissionOrApproval','지식 작성 권한이 필요합니다.','caseSummary','','outcomeAndLesson','','tags',jsonb_build_array('첨부'),'relatedManualRefs','[]'::jsonb,'relatedIssueIds','[]'::jsonb,'relatedRepairIds','[]'::jsonb,'reviewDueAt','2027-02-21T00:00:00.000Z');
 select*into r from public.hotel_knowledge_command_v1(c,kh,'CREATE',0,base||jsonb_build_object('scopeType','HOTEL','hotelId',h),repeat('I',43),gen_random_uuid(),'knowledge-attachment-hotel-create','POST','/api/knowledge','knowledge-attachment-hotel-create-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'CREATED'then raise exception'hotel attachment draft create failed: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_command_v1(c,kc,'CREATE',0,base||jsonb_build_object('scopeType','COMPANY','hotelId',null),repeat('I',43),gen_random_uuid(),'knowledge-attachment-company-create','POST','/api/knowledge','knowledge-attachment-company-create-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'CREATED'then raise exception'company attachment draft create failed: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,h,'6b303000-0000-4000-8000-000000000001','UPLOAD_INIT',0,jsonb_build_object('parent',jsonb_build_object('type','WRONG_PARENT','knowledgeId',kh),'fileName','state.png','mimeType','image/png','sizeBytes',12,'quarantineObjectKey','quarantine/6b303000-0000-4000-8000-000000000001/'||repeat('S',43),'reservationFingerprint',repeat('c',64)),repeat('I',43),gen_random_uuid(),'knowledge-file-state-rejected','POST','/api/knowledge/'||kh||'/files/upload-init','knowledge-file-state-rejected-hash','6b3a0000-0000-4000-8000-000000000003','6b3a0000-0000-4000-8000-000000000004');if r.command_status<>'INVALID_STATE_TRANSITION'then raise exception'file state rejection missing: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,h,'6b304000-0000-4000-8000-000000000001','UPLOAD_INIT',0,jsonb_build_object('parent',jsonb_build_object('type','KNOWLEDGE_ATTACHMENT','knowledgeId',kh),'fileName','reservation.png','mimeType','image/png','sizeBytes',12,'quarantineObjectKey','invalid-key','reservationFingerprint',repeat('d',64)),repeat('I',43),gen_random_uuid(),'knowledge-file-reservation-rejected','POST','/api/knowledge/'||kh||'/files/upload-init','knowledge-file-reservation-rejected-hash','6b3a0000-0000-4000-8000-000000000005','6b3a0000-0000-4000-8000-000000000006');if r.command_status<>'INVALID_STATE_TRANSITION'then raise exception'file reservation rejection missing: %',r.command_status;end if;
 begin perform public.hotel_knowledge_file_command_v1(c,h,'6b305000-0000-4000-8000-000000000001','UPLOAD_INIT',0,jsonb_build_object('parent',jsonb_build_object('type','KNOWLEDGE_ATTACHMENT','knowledgeId',kh),'fileName','collision.png','mimeType','image/png','sizeBytes',12,'quarantineObjectKey','invalid-key','reservationFingerprint',repeat('e',64)),repeat('I',43),gen_random_uuid(),'knowledge-file-audit-collision','POST','/api/knowledge/'||kh||'/files/upload-init','knowledge-file-audit-collision-hash','6b3a0000-0000-4000-8000-000000000001','6b3a0000-0000-4000-8000-000000000007');raise exception'audit collision failure was swallowed';exception when unique_violation then null;end;if exists(select 1 from public.hotel_file_uploads where company_id=c and id='6b305000-0000-4000-8000-000000000001')then raise exception'audit collision did not roll back upload';end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,h,uh,'UPLOAD_INIT',0,jsonb_build_object('parent',jsonb_build_object('type','KNOWLEDGE_ATTACHMENT','knowledgeId',kh),'fileName','호텔지식.png','mimeType','image/png','sizeBytes',12,'quarantineObjectKey','quarantine/'||uh||'/'||repeat('H',43),'reservationFingerprint',repeat('a',64)),repeat('I',43),gen_random_uuid(),'knowledge-hotel-file-init','POST','/api/knowledge/'||kh||'/files/upload-init','knowledge-hotel-file-init-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'CREATED'then raise exception'hotel file init failed: % %',r.command_status,r.result_snapshot;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,h,uh,'UPLOAD_COMPLETE',0,jsonb_build_object('etag','bad-etag','objectVersion','knowledge-hotel-source-v1','sizeBytes',12,'mimeType','image/png','reservationFingerprint',repeat('a',64),'scanJobId',gen_random_uuid()),repeat('I',43),gen_random_uuid(),'knowledge-hotel-file-complete-integrity','POST','/api/files/uploads/'||uh||'/complete','knowledge-hotel-file-complete-integrity-hash','6b3a0000-0000-4000-8000-000000000008','6b3a0000-0000-4000-8000-000000000009');if r.command_status<>'FILE_INTEGRITY_MISMATCH'then raise exception'file completion integrity rejection missing: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,h,uh,'UPLOAD_COMPLETE',0,jsonb_build_object('etag','"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"','objectVersion','knowledge-hotel-source-v1','sizeBytes',12,'mimeType','image/png','reservationFingerprint',repeat('a',64),'scanJobId',sh),repeat('I',43),gen_random_uuid(),'knowledge-hotel-file-complete','POST','/api/files/uploads/'||uh||'/complete','knowledge-hotel-file-complete-hash',gen_random_uuid(),gen_random_uuid());if r.command_status not in('UPDATED','REPLAYED')then raise exception'hotel file complete failed: % %',r.command_status,r.result_snapshot;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,null,uc,'UPLOAD_INIT',0,jsonb_build_object('parent',jsonb_build_object('type','KNOWLEDGE_ATTACHMENT','knowledgeId',kc),'fileName','회사지식.png','mimeType','image/png','sizeBytes',12,'quarantineObjectKey','quarantine/'||uc||'/'||repeat('C',43),'reservationFingerprint',repeat('b',64)),repeat('I',43),gen_random_uuid(),'knowledge-company-file-init','POST','/api/knowledge/'||kc||'/files/upload-init','knowledge-company-file-init-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'CREATED'then raise exception'company file init failed: % %',r.command_status,r.result_snapshot;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,null,uc,'UPLOAD_COMPLETE',0,jsonb_build_object('etag','"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"','objectVersion','knowledge-company-source-v1','sizeBytes',12,'mimeType','image/png','reservationFingerprint',repeat('b',64),'scanJobId',sc),repeat('I',43),gen_random_uuid(),'knowledge-company-file-complete','POST','/api/files/uploads/'||uc||'/complete','knowledge-company-file-complete-hash',gen_random_uuid(),gen_random_uuid());if r.command_status not in('UPDATED','REPLAYED')then raise exception'company file complete failed: % %',r.command_status,r.result_snapshot;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,h,ue,'UPLOAD_INIT',0,jsonb_build_object('parent',jsonb_build_object('type','KNOWLEDGE_ATTACHMENT','knowledgeId',kh),'fileName','expired.png','mimeType','image/png','sizeBytes',12,'quarantineObjectKey','quarantine/'||ue||'/'||repeat('E',43),'reservationFingerprint',repeat('f',64)),repeat('I',43),gen_random_uuid(),'knowledge-expired-file-init','POST','/api/knowledge/'||kh||'/files/upload-init','knowledge-expired-file-init-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'CREATED'then raise exception'expired fixture init failed: %',r.command_status;end if;
end $attachment_prepare$;
select 'HOTEL_KNOWLEDGE_ATTACHMENT_PREPARE_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_ATTACHMENT_PREPARE_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
update public.hotel_file_uploads set created_at=statement_timestamp()-interval'10 minutes',expires_at=statement_timestamp()-interval'5 minutes',updated_at=statement_timestamp()where company_id='10000000-0000-0000-0000-000000000001'and id='6b302000-0000-4000-8000-000000000001';
with actor as(select user_id from public.auth_sessions where id='4f000000-0000-4000-8000-000000000001'),fixture as(select gen_random_uuid()id from generate_series(1,8))
insert into public.hotel_file_uploads(id,company_id,branch_id,parent_type,knowledge_id,display_name,declared_mime,reserved_size,quarantine_object_key,reservation_fingerprint,status,initiated_by,initiated_session_id,expires_at)
select f.id,'10000000-0000-0000-0000-000000000001','50000000-0000-4000-8000-000000000001','KNOWLEDGE_ATTACHMENT','6b210000-0000-4000-8000-000000000001','quota-fixture','image/png',12,'quarantine/'||f.id||'/'||repeat('Q',43),encode(sha256(convert_to(f.id::text,'UTF8')),'hex'),'PENDING_UPLOAD',a.user_id,'4f000000-0000-4000-8000-000000000001',statement_timestamp()+interval'5 minutes'from fixture f cross join actor a;
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $upload_terminal_failures$
declare c uuid:='10000000-0000-0000-0000-000000000001';h uuid:='50000000-0000-4000-8000-000000000001';kh uuid:='6b210000-0000-4000-8000-000000000001';ue uuid:='6b302000-0000-4000-8000-000000000001';uq uuid:='6b306000-0000-4000-8000-000000000001';r record;
begin
 perform set_config('app.company_id',c::text,true);perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
 select*into r from public.hotel_knowledge_file_command_v1(c,h,ue,'UPLOAD_COMPLETE',0,jsonb_build_object('etag','"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"','objectVersion','expired-source','sizeBytes',12,'mimeType','image/png','reservationFingerprint',repeat('f',64),'scanJobId',gen_random_uuid()),repeat('I',43),gen_random_uuid(),'knowledge-file-expired-rejected','POST','/api/files/uploads/'||ue||'/complete','knowledge-file-expired-rejected-hash','6b3a0000-0000-4000-8000-00000000000a','6b3a0000-0000-4000-8000-00000000000b');if r.command_status<>'FILE_UPLOAD_EXPIRED'then raise exception'file expiration rejection missing: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_file_command_v1(c,h,uq,'UPLOAD_INIT',0,jsonb_build_object('parent',jsonb_build_object('type','KNOWLEDGE_ATTACHMENT','knowledgeId',kh),'fileName','quota.png','mimeType','image/png','sizeBytes',12,'quarantineObjectKey','quarantine/'||uq||'/'||repeat('Q',43),'reservationFingerprint',repeat('a',64)),repeat('I',43),gen_random_uuid(),'knowledge-file-quota-rejected','POST','/api/knowledge/'||kh||'/files/upload-init','knowledge-file-quota-rejected-hash','6b3a0000-0000-4000-8000-00000000000c','6b3a0000-0000-4000-8000-00000000000d');if r.command_status<>'FILE_QUOTA_EXCEEDED'then raise exception'file quota rejection missing: %',r.command_status;end if;
end $upload_terminal_failures$;
select 'HOTEL_KNOWLEDGE_UPLOAD_TERMINAL_FAILURES_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_UPLOAD_TERMINAL_FAILURES_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  printf 'HOTEL_KNOWLEDGE_UPLOAD_TERMINAL_FAILURES_OK\n'
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.hotel_file_uploads where company_id='10000000-0000-0000-0000-000000000001'and display_name='quota-fixture'" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
do $promote$
declare c uuid:='10000000-0000-0000-0000-000000000001';r record;
begin
 for r in select * from (values
  ('6b300000-0000-4000-8000-000000000001'::uuid,'6b310000-0000-4000-8000-000000000001'::uuid,'6b320000-0000-4000-8000-000000000001'::uuid,'"cccccccccccccccccccccccccccccccc"'::text,'hotel-clean-v1'::text),
  ('6b301000-0000-4000-8000-000000000001'::uuid,'6b311000-0000-4000-8000-000000000001'::uuid,'6b321000-0000-4000-8000-000000000001'::uuid,'"dddddddddddddddddddddddddddddddd"'::text,'company-clean-v1'::text)
 )v(upload_id,file_id,scan_id,clean_etag,clean_version)
 loop
  update public.hotel_file_uploads set status='READY_UNLINKED',updated_at=statement_timestamp()where company_id=c and id=r.upload_id;
  insert into public.hotel_file_versions(id,company_id,branch_id,upload_id,clean_object_key,clean_etag,clean_object_version,clean_sha256,clean_size,detected_mime,display_name,exif_location_removed,original_retention_until)
  select r.file_id,u.company_id,u.branch_id,u.id,'clean/'||r.file_id,r.clean_etag,r.clean_version,decode(repeat('ab',32),'hex'),u.reserved_size,u.declared_mime,u.display_name,true,statement_timestamp()+interval'5 years'from public.hotel_file_uploads u where u.company_id=c and u.id=r.upload_id;
  update public.hotel_file_scan_jobs set status='COMPLETED',attempt_count=1,scanner_sha256=decode(repeat('ab',32),'hex'),detected_mime='image/png',file_version_id=r.file_id,clean_object_key='clean/'||r.file_id,completed_at=statement_timestamp(),updated_at=statement_timestamp()where company_id=c and id=r.scan_id and upload_id=r.upload_id;
  if not found then raise exception'scan job promotion missing: %',r.scan_id;end if;
 end loop;
end $promote$;
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $attachment_journey$
declare c uuid:='10000000-0000-0000-0000-000000000001';h uuid:='50000000-0000-4000-8000-000000000001';kh uuid:='6b210000-0000-4000-8000-000000000001';kc uuid:='6b220000-0000-4000-8000-000000000001';uh uuid:='6b300000-0000-4000-8000-000000000001';uc uuid:='6b301000-0000-4000-8000-000000000001';fh uuid:='6b310000-0000-4000-8000-000000000001';fc uuid:='6b311000-0000-4000-8000-000000000001';r record;grant_id uuid;trace_id uuid;completion_token text:=repeat('T',43);
begin
 perform set_config('app.company_id',c::text,true);perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
 select*into r from public.hotel_knowledge_file_scope_v1(c,uh,repeat('I',43));if r.branch_id<>h or r.knowledge_id<>kh then raise exception'hotel scope mismatch: %',to_jsonb(r);end if;
 select*into r from public.hotel_knowledge_file_scope_v1(c,uc,repeat('I',43));if r.branch_id is not null or r.knowledge_id<>kc then raise exception'company scope mismatch: %',to_jsonb(r);end if;
 select*into r from public.hotel_knowledge_attachment_command_v1(c,kh,1,jsonb_build_object('fileVersionIds',jsonb_build_array(fc),'reason','cross-parent 차단'),repeat('I',43),gen_random_uuid(),'knowledge-cross-parent-link','PUT','/api/knowledge/'||kh||'/attachments','knowledge-cross-parent-link-hash',gen_random_uuid(),gen_random_uuid());if r.command_status not in('NOT_FOUND','VALIDATION_ERROR')then raise exception'cross-parent link accepted: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_attachment_command_v1(c,kh,1,jsonb_build_object('fileVersionIds',jsonb_build_array(fh),'reason','호텔 private 첨부 연결'),repeat('I',43),gen_random_uuid(),'knowledge-hotel-file-link','PUT','/api/knowledge/'||kh||'/attachments','knowledge-hotel-file-link-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'or jsonb_array_length(r.result_snapshot->'attachments')<>1 then raise exception'hotel file link failed: % %',r.command_status,r.result_snapshot;end if;
 select*into r from public.hotel_knowledge_attachment_command_v1(c,kh,1,jsonb_build_object('fileVersionIds',jsonb_build_array(fh),'reason','호텔 private 첨부 연결'),repeat('I',43),gen_random_uuid(),'knowledge-hotel-file-link','PUT','/api/knowledge/'||kh||'/attachments','knowledge-hotel-file-link-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'REPLAYED'then raise exception'hotel file link replay failed: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_attachment_command_v1(c,kh,2,jsonb_build_object('fileVersionIds',jsonb_build_array(fh),'reason','다른 payload'),repeat('I',43),gen_random_uuid(),'knowledge-hotel-file-link','PUT','/api/knowledge/'||kh||'/attachments','knowledge-hotel-file-link-different-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'IDEMPOTENCY_CONFLICT'then raise exception'hotel file link conflict lost: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_attachment_command_v1(c,kh,2,jsonb_build_object('fileVersionIds','[]'::jsonb,'reason','기존 첨부 제거 시도'),repeat('I',43),gen_random_uuid(),'knowledge-hotel-file-detach','PUT','/api/knowledge/'||kh||'/attachments','knowledge-hotel-file-detach-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'VALIDATION_ERROR'then raise exception'logical detach accepted: %',r.command_status;end if;
 select*into r from public.hotel_knowledge_attachment_command_v1(c,kc,1,jsonb_build_object('fileVersionIds',jsonb_build_array(fc),'reason','회사 공통 private 첨부 연결'),repeat('I',43),gen_random_uuid(),'knowledge-company-file-link','PUT','/api/knowledge/'||kc||'/attachments','knowledge-company-file-link-hash',gen_random_uuid(),gen_random_uuid());if r.command_status<>'UPDATED'or jsonb_array_length(r.result_snapshot->'attachments')<>1 then raise exception'company file link failed: % %',r.command_status,r.result_snapshot;end if;
 grant_id:=gen_random_uuid();trace_id:=gen_random_uuid();select*into r from public.hotel_knowledge_file_view_v1(c,kh,fh,'AUTHORIZE',repeat('I',43),grant_id,completion_token,gen_random_uuid(),gen_random_uuid(),trace_id);if r.command_status<>'OK'or r.result_snapshot->>'cleanObjectKey'<>'clean/'||fh then raise exception'hotel view authorize failed: % %',r.command_status,r.result_snapshot;end if;select*into r from public.hotel_knowledge_file_view_v1(c,kh,fh,'SUCCEEDED',repeat('I',43),grant_id,completion_token,gen_random_uuid(),gen_random_uuid(),trace_id);if r.command_status<>'RECORDED'then raise exception'hotel view success audit failed: %',r.command_status;end if;
 grant_id:=gen_random_uuid();trace_id:=gen_random_uuid();select*into r from public.hotel_knowledge_file_view_v1(c,kc,fc,'AUTHORIZE',repeat('I',43),grant_id,completion_token,gen_random_uuid(),gen_random_uuid(),trace_id);if r.command_status<>'OK'or r.result_snapshot->>'cleanObjectKey'<>'clean/'||fc then raise exception'company view authorize failed: % %',r.command_status,r.result_snapshot;end if;select*into r from public.hotel_knowledge_file_view_v1(c,kc,fc,'SUCCEEDED',repeat('I',43),grant_id,completion_token,gen_random_uuid(),gen_random_uuid(),trace_id);if r.command_status<>'RECORDED'then raise exception'company view success audit failed: %',r.command_status;end if;
 perform set_config('app.session_id','d9230000-0000-4000-8000-000000000001',true);select*into r from public.hotel_knowledge_file_view_v1(c,kh,fh,'AUTHORIZE',repeat('O',43),gen_random_uuid(),completion_token,gen_random_uuid(),gen_random_uuid(),gen_random_uuid());if r.command_status<>'NOT_FOUND'then raise exception'explicit deny/draft view accepted: %',r.command_status;end if;
end $attachment_journey$;
select 'HOTEL_KNOWLEDGE_ATTACHMENT_ACTUAL_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_ATTACHMENT_ACTUAL_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
select gen_random_uuid(),s.company_id,'50000000-0000-4000-8000-000000000001','USER',s.user_id,'HOTEL_FILE_READ','DENY',statement_timestamp()-interval'1 day',s.user_id,'지식 읽기 허용 파일 읽기 explicit deny actual'from public.auth_sessions s where s.id='4f000000-0000-4000-8000-000000000001';
SQL
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" <<'SQL'
do $file_read_deny$
declare c uuid:='10000000-0000-0000-0000-000000000001';k uuid:='6b210000-0000-4000-8000-000000000001';f uuid:='6b310000-0000-4000-8000-000000000001';r record;
begin
 perform set_config('app.company_id',c::text,true);perform set_config('app.session_id','4f000000-0000-4000-8000-000000000001',true);
 select*into r from public.hotel_knowledge_read_v1(c,k,'{}',repeat('I',43));if r.command_status<>'OK'or jsonb_array_length(r.result_snapshot->'attachments')<>0 then raise exception'file-read deny projection failed: % %',r.command_status,r.result_snapshot;end if;
 select*into r from public.hotel_knowledge_file_view_v1(c,k,f,'AUTHORIZE',repeat('I',43),gen_random_uuid(),repeat('T',43),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());if r.command_status<>'NOT_FOUND'then raise exception'file-read explicit deny authorize accepted: %',r.command_status;end if;
end $file_read_deny$;
select 'HOTEL_KNOWLEDGE_FILE_READ_EXPLICIT_DENY_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_FILE_READ_EXPLICIT_DENY_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "delete from public.permission_grants where reason='지식 읽기 허용 파일 읽기 explicit deny actual'" >/dev/null
  set +e; psql -X -v ON_ERROR_STOP=1 -At -d "$api_url" -c "select count(*) from public.hotel_knowledge_entries" >/dev/null 2>&1; direct_status=$?; set -e
  [[ "$direct_status" -ne 0 ]] || { printf '%s\n' "knowledge API direct table access succeeded" >&2; return 1; }
  result="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
do $verify$
declare c uuid:='10000000-0000-0000-0000-000000000001';k uuid:='6b200000-0000-4000-8000-000000000001';kh uuid:='6b210000-0000-4000-8000-000000000001';fh uuid:='6b310000-0000-4000-8000-000000000001';
begin
 if(select count(*)from public.hotel_knowledge_versions where company_id=c and knowledge_id=k)<>7 then raise exception'version count mismatch';end if;if exists(select 1 from public.hotel_knowledge_versions where company_id=c and knowledge_id=k and not(snapshot?'entry'and snapshot?'relatedIssueIds'and snapshot?'relatedRepairIds'and snapshot?'attachmentFileVersionIds')or snapshot?'actions')then raise exception'version snapshot incomplete or actor-projected';end if;
 if not exists(select 1 from public.hotel_knowledge_versions where company_id=c and knowledge_id=kh and action='ATTACHMENTS_UPDATE'and snapshot->'attachmentFileVersionIds'=jsonb_build_array(fh)and not(snapshot?'actions'))then raise exception'attachment version snapshot is not canonical';end if;
 if not exists(select 1 from public.audit_events where company_id=c and resource_id=kh and event_code in('KNOWLEDGE_ATTACHMENT_PARENT_REJECTED','KNOWLEDGE_ATTACHMENT_SET_REJECTED')and result='DENIED'and after_summary='{}'::jsonb)then raise exception'attachment terminal failure audit missing';end if;
 if(select count(distinct event_code)from public.audit_events where company_id=c and resource_id=kh and event_code in('KNOWLEDGE_FILE_STATE_REJECTED','KNOWLEDGE_FILE_QUOTA_REJECTED','KNOWLEDGE_FILE_RESERVATION_REJECTED','KNOWLEDGE_FILE_EXPIRED_REJECTED','KNOWLEDGE_FILE_COMPLETION_REJECTED')and result='DENIED'and after_summary='{}'::jsonb)<>5 then raise exception'upload terminal failure audits missing';end if;
 if exists(select 1 from public.audit_events where company_id=c and resource_id=kh and event_code like 'KNOWLEDGE_FILE_%_REJECTED'and(coalesce(reason,'')~*'(state\\.png|reservation\\.png|quota\\.png|expired\\.png|etag|quarantine/|objectVersion)'or after_summary<>'{}'::jsonb))then raise exception'upload failure audit leaked request metadata';end if;
 begin update public.hotel_knowledge_versions set reason='tamper'where company_id=c and knowledge_id=k;raise exception'version update accepted';exception when sqlstate'55000'then null;end;
 if(select count(*)from public.audit_events where company_id=c and resource_type='KNOWLEDGE_ENTRY'and resource_id=k)<8 then raise exception'audit missing';end if;if has_table_privilege('gw_api_probe','public.hotel_knowledge_entries','SELECT')or has_table_privilege('gw_api_probe','public.hotel_knowledge_versions','SELECT')then raise exception'API table ACL widened';end if;if has_function_privilege('gw_runtime_probe','public.hotel_knowledge_command_v1(uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)','EXECUTE')then raise exception'reconciler execute widened';end if;
end $verify$;
select 'HOTEL_KNOWLEDGE_BANK_CATALOG_HISTORY_OK';
SQL
)"
  [[ "$result" == *"HOTEL_KNOWLEDGE_BANK_CATALOG_HISTORY_OK"* ]] || { printf '%s\n' "$result" >&2; return 1; }
  printf '%s\n' "HOTEL_KNOWLEDGE_BANK_ACTUAL_INTEGRATION_OK"
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
    if to_regprocedure('public.hotel_issue_read_v1(uuid,uuid,uuid,jsonb,text)') is not null then
      execute format('grant execute on function public.hotel_issue_capabilities_v1(uuid,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_issue_read_v1(uuid,uuid,uuid,jsonb,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_issue_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
    end if;
    if to_regprocedure('public.hotel_daily_sales_read_v1(uuid,uuid,uuid,jsonb,text)') is not null then
      execute format('grant execute on function public.hotel_daily_sales_capabilities_v1(uuid,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_daily_sales_read_v1(uuid,uuid,uuid,jsonb,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_daily_sales_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_daily_sales_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid) to %I', capability_role.role_name);
    end if;
    if to_regprocedure('public.hotel_file_scanner_agent_command_v1(uuid,text,text,bigint,jsonb,uuid)') is not null then
      insert into public.hotel_file_scanner_agent_capabilities (role_name)
      values (capability_role.role_name)
      on conflict (role_name) do nothing;
      execute format('grant select on public.hotel_file_scanner_agent_capabilities to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_file_scanner_agent_command_v1(uuid,text,text,bigint,jsonb,uuid) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_file_scanner_agent_candidates_v1(integer) to %I', capability_role.role_name);
    end if;
    if to_regprocedure('public.hotel_calendar_capabilities_v1(uuid,text)') is not null then
      execute format('grant execute on function public.hotel_calendar_capabilities_v1(uuid,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_calendar_events_read_v1(uuid,uuid,jsonb,text) to %I', capability_role.role_name);
      execute format('grant execute on function public.hotel_calendar_visit_options_read_v1(uuid,uuid,text) to %I', capability_role.role_name);
    end if;
  end loop;
  for capability_role in select role_name from public.runtime_database_capabilities where capability='RECONCILER'
  loop
    if to_regclass('public.hotel_file_scanner_agent_capabilities') is not null then
      execute format('grant select on public.hotel_file_scanner_agent_capabilities to %I', capability_role.role_name);
    end if;
    if to_regprocedure('public.scheduled_reconciler_invocation_enter_v1()') is not null then
      execute format('grant execute on function public.scheduled_reconciler_invocation_enter_v1() to %I', capability_role.role_name);
      execute format('grant execute on function public.scheduled_reconciler_invocation_exit_v1() to %I', capability_role.role_name);
      execute format('grant execute on function public.scheduled_reconciler_drain_barrier_v1() to %I', capability_role.role_name);
    end if;
  end loop;
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

run_actual_operational_issue_api_probe() {
  local admin_url="$1"
  local api_probe_url probe_status
  api_probe_url="$(configure_api_probe_role "$admin_url")"
  grant_repair_lifecycle_capabilities "$admin_url"
  set +e
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$api_probe_url" \
      pnpm exec tsx apps/api/test/hotel-operational-issues-actual-api-integration.ts
  )
  probe_status=$?
  set -e
  cleanup_api_probe_role "$admin_url"
  return "$probe_status"
}

run_actual_daily_sales_api_probe() {
  local admin_url="$1"
  local api_probe_url probe_status
  api_probe_url="$(configure_api_probe_role "$admin_url")"
  grant_repair_lifecycle_capabilities "$admin_url"
  set +e
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$api_probe_url" \
      pnpm exec tsx apps/api/test/hotel-daily-sales-actual-api-integration.ts
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

const result = await probeDatabaseReadiness(process.env.TEST_READY_URL, {
  capability: process.env.TEST_READY_CAPABILITY ?? "RECONCILER",
});
if (result.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY, received ${result.status}`);
}
NODE
  )
  if [[ -n "${READINESS_SECOND_PROBE_URL:-}" && "$probe_url" != "$READINESS_SECOND_PROBE_URL" ]]; then
    READINESS_SECOND_PROBE_URL= TEST_READY_CAPABILITY=API_RUNTIME assert_schema_not_ready "$READINESS_SECOND_PROBE_URL"
  fi
}

assert_schema_ready() {
  local probe_url="$1"
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$probe_url" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

let checkpoint = "NONE";
const result = await probeDatabaseReadiness(process.env.TEST_READY_URL, {
  capability: process.env.TEST_READY_CAPABILITY ?? "RECONCILER",
  onSchemaNotReady: (value) => {
    checkpoint = value;
  },
});
if (result.status !== "READY") {
  throw new Error(`expected READY, received ${result.status} at ${checkpoint}`);
}
NODE
  )
  if [[ -n "${READINESS_SECOND_PROBE_URL:-}" && "$probe_url" != "$READINESS_SECOND_PROBE_URL" ]]; then
    READINESS_SECOND_PROBE_URL= TEST_READY_CAPABILITY=API_RUNTIME assert_schema_ready "$READINESS_SECOND_PROBE_URL"
  fi
}

assert_operational_issue_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter table public.hotel_issue_notification_outbox rename column read_at to read_at_damaged' \
    >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter table public.hotel_issue_notification_outbox rename column read_at_damaged to read_at' \
    >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'grant select(read_at) on public.hotel_issue_notification_outbox to gw_runtime_probe' \
    >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'revoke select(read_at) on public.hotel_issue_notification_outbox from gw_runtime_probe' \
    >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter index public.hotel_issue_notification_outbox_recipient_unread_idx rename to hotel_issue_notification_recipient_unread_damaged_idx' \
    >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter index public.hotel_issue_notification_recipient_unread_damaged_idx rename to hotel_issue_notification_outbox_recipient_unread_idx' \
    >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter index public.hotel_inquiry_notifications_recipient_unread_idx rename to hotel_inquiry_notifications_recipient_unread_damaged_idx' \
    >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter index public.hotel_inquiry_notifications_recipient_unread_damaged_idx rename to hotel_inquiry_notifications_recipient_unread_idx' \
    >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'grant select on public.hotel_issue_internal_notes to gw_runtime_probe' \
    >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'revoke select on public.hotel_issue_internal_notes from gw_runtime_probe' \
    >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter function public.hotel_issue_actor_v1(uuid,uuid,text,text) security invoker' \
    >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -c 'alter function public.hotel_issue_actor_v1(uuid,uuid,text,text) security definer' \
    >/dev/null
  assert_schema_ready "$probe_url"
  printf 'HOTEL_OPERATIONAL_ISSUES_READINESS_DAMAGE_OK\n'
}

assert_daily_sales_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table public.hotel_daily_sales
  drop constraint hotel_daily_sales_company_id_branch_id_business_date_key;
alter table public.hotel_daily_sales
  add constraint hotel_daily_sales_company_id_branch_id_business_date_key unique(id);
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table public.hotel_daily_sales
  drop constraint hotel_daily_sales_company_id_branch_id_business_date_key;
alter table public.hotel_daily_sales
  add constraint hotel_daily_sales_company_id_branch_id_business_date_key unique(company_id,branch_id,business_date);
SQL
  assert_schema_ready "$probe_url"
  printf 'HOTEL_DAILY_SALES_READINESS_DAMAGE_OK\n'
}

assert_knowledge_core_readiness_damage() {
  local admin_url="$1" probe_url="$2" definition owner
  assert_schema_ready "$probe_url"
  definition="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_functiondef('public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text)'::regprocedure)")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "create or replace function public.hotel_knowledge_has_permission_v1(p_company_id uuid,p_user_id uuid,p_branch_id uuid,p_permission_code text)returns boolean language sql stable security definer set search_path=pg_catalog as \$f\$select false\$f\$" >/dev/null
  [[ "$(psql -X -At -d "$admin_url" -c "select btrim(prosrc)='select false' from pg_catalog.pg_proc where oid='public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text)'::regprocedure")" == "t" ]] || { printf 'knowledge helper body damage did not apply\n' >&2; return 1; }
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "$definition" >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'grant execute on function public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text) to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'revoke execute on function public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text) from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  owner="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_userbyid(p.proowner)from pg_catalog.pg_proc p where p.oid='public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text)'::regprocedure")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter function public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text) owner to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "alter function public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text) owner to \"$owner\"" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'revoke all on function public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text) from public' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_entries disable trigger hotel_knowledge_search_vector' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_entries enable trigger hotel_knowledge_search_vector' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_versions disable trigger hotel_knowledge_versions_append_only' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_versions enable trigger hotel_knowledge_versions_append_only' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_entries no force row level security' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_entries force row level security' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'create policy hotel_knowledge_entries_unexpected_permissive on public.hotel_knowledge_entries using (true) with check (true)' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'drop policy hotel_knowledge_entries_unexpected_permissive on public.hotel_knowledge_entries' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'grant select(title) on public.hotel_knowledge_entries to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'revoke select(title) on public.hotel_knowledge_entries from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop index public.hotel_knowledge_links_issue_unique_idx;
create unique index hotel_knowledge_links_issue_unique_idx on public.hotel_knowledge_links(company_id,knowledge_id,issue_id);
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop index public.hotel_knowledge_links_issue_unique_idx;
create unique index hotel_knowledge_links_issue_unique_idx on public.hotel_knowledge_links(company_id,knowledge_id,issue_id)where link_kind='ISSUE';
SQL
  assert_schema_ready "$probe_url"
  owner="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_userbyid(c.relowner)from pg_catalog.pg_class c where c.oid='public.hotel_knowledge_links'::regclass")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_links owner to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "alter table public.hotel_knowledge_links owner to \"$owner\"" >/dev/null
  assert_schema_ready "$probe_url"
  printf 'HOTEL_KNOWLEDGE_CORE_READINESS_DAMAGE_OK\n'
}

assert_knowledge_attachments_pre_expand_parent_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  local parent_check_definition
  assert_schema_ready "$probe_url"
  parent_check_definition="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_constraintdef(oid,true) from pg_catalog.pg_constraint where conrelid='public.hotel_file_uploads'::regclass and conname='hotel_file_uploads_parent_exact_check'")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_file_uploads drop constraint hotel_file_uploads_parent_exact_check' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "alter table public.hotel_file_uploads add constraint hotel_file_uploads_parent_exact_check $parent_check_definition" >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter index public.hotel_file_uploads_pkey rename to hotel_file_uploads_pkey_damage' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter index public.hotel_file_uploads_pkey_damage rename to hotel_file_uploads_pkey' >/dev/null
  assert_schema_ready "$probe_url"
  printf 'HOTEL_KNOWLEDGE_ATTACHMENTS_PRE_EXPAND_PARENT_READINESS_DAMAGE_OK\n'
}

assert_knowledge_attachments_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  local owner
  local parent_check_definition
  local parent_fk_definition
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table public.hotel_knowledge_versions
  drop constraint hotel_knowledge_versions_action_check,
  add constraint hotel_knowledge_versions_action_check check(
    action in ('CREATE','UPDATE','REQUEST_REVIEW','PUBLISH','MARK_NEEDS_REVIEW','AUTO_NEEDS_REVIEW','REPUBLISH','ARCHIVE')
  );
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table public.hotel_knowledge_versions
  drop constraint hotel_knowledge_versions_action_check,
  add constraint hotel_knowledge_versions_action_check check(
    action in ('CREATE','UPDATE','REQUEST_REVIEW','PUBLISH','MARK_NEEDS_REVIEW','AUTO_NEEDS_REVIEW','REPUBLISH','ARCHIVE','ATTACHMENTS_UPDATE')
  );
SQL
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'create policy hotel_knowledge_attachments_unexpected_permissive on public.hotel_knowledge_attachments using (true) with check (true)' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'drop policy hotel_knowledge_attachments_unexpected_permissive on public.hotel_knowledge_attachments' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'grant execute on function public.hotel_knowledge_idempotency_begin_v1(uuid,uuid,text,text,text,text) to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'revoke execute on function public.hotel_knowledge_idempotency_begin_v1(uuid,uuid,text,text,text,text) from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'grant select(file_version_id) on public.hotel_knowledge_attachments to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'revoke select(file_version_id) on public.hotel_knowledge_attachments from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  owner="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_userbyid(c.relowner)from pg_catalog.pg_class c where c.oid='public.hotel_knowledge_attachments'::regclass")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_knowledge_attachments owner to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "alter table public.hotel_knowledge_attachments owner to \"$owner\"" >/dev/null
  assert_schema_ready "$probe_url"
  parent_check_definition="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_constraintdef(oid,true) from pg_catalog.pg_constraint where conrelid='public.hotel_file_uploads'::regclass and conname='hotel_file_uploads_parent_exact_check'")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_file_uploads drop constraint hotel_file_uploads_parent_exact_check' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "alter table public.hotel_file_uploads add constraint hotel_file_uploads_parent_exact_check $parent_check_definition" >/dev/null
  assert_schema_ready "$probe_url"
  parent_fk_definition="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_constraintdef(oid,true) from pg_catalog.pg_constraint where conrelid='public.hotel_file_access_grants'::regclass and conname='hotel_file_access_grants_knowledge_fkey'")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter table public.hotel_file_access_grants drop constraint hotel_file_access_grants_knowledge_fkey' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "alter table public.hotel_file_access_grants add constraint hotel_file_access_grants_knowledge_fkey $parent_fk_definition" >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter index public.hotel_file_uploads_pkey rename to hotel_file_uploads_pkey_damage' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c 'alter index public.hotel_file_uploads_pkey_damage rename to hotel_file_uploads_pkey' >/dev/null
  assert_schema_ready "$probe_url"
  printf 'HOTEL_KNOWLEDGE_ATTACHMENTS_READINESS_DAMAGE_OK\n'
}

assert_owner_inquiries_readiness_damage() {
  local admin_url="$1"
  local probe_url="$2"
  local history_definition
  local settings_definition
  assert_schema_ready "$probe_url"
  history_definition="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_functiondef('public.inquiry_history_append_only()'::regprocedure)")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "create or replace function public.inquiry_history_append_only() returns trigger language plpgsql set search_path=pg_catalog as \$f\$ begin return old; end \$f\$" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "$history_definition" >/dev/null
  assert_schema_ready "$probe_url"
  settings_definition="$(psql -X -At -d "$admin_url" -c "select pg_catalog.pg_get_functiondef('public.hotel_inquiry_settings_snapshot_v1(uuid,uuid)'::regprocedure)")"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    "create or replace function public.hotel_inquiry_settings_snapshot_v1(p_company_id uuid,p_branch_id uuid) returns jsonb language sql stable set search_path=pg_catalog as \$f\$ select '{}'::jsonb \$f\$" >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c "$settings_definition" >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant execute on function public.inquiry_history_append_only() to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke execute on function public.inquiry_history_append_only() from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant execute on function public.hotel_inquiry_settings_snapshot_v1(uuid,uuid) to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke execute on function public.hotel_inquiry_settings_snapshot_v1(uuid,uuid) from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'alter table public.hotel_inquiries no force row level security' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'alter table public.hotel_inquiries force row level security' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant update on public.hotel_inquiries to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke update on public.hotel_inquiries from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant select on public.hotel_inquiries to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke select on public.hotel_inquiries from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant select(title) on public.hotel_inquiries to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke select(title) on public.hotel_inquiries from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop policy hotel_inquiries_company_isolation on public.hotel_inquiries;
create policy hotel_inquiries_company_isolation on public.hotel_inquiries
  using (public.hotel_inquiry_rls_company_guard_v1(company_id) or true)
  with check (public.hotel_inquiry_rls_company_guard_v1(company_id) or true);
SQL
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop policy hotel_inquiries_company_isolation on public.hotel_inquiries;
create policy hotel_inquiries_company_isolation on public.hotel_inquiries
  using (public.hotel_inquiry_rls_company_guard_v1(company_id))
  with check (public.hotel_inquiry_rls_company_guard_v1(company_id));
SQL
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant execute on function public.hotel_inquiry_snapshot_v1(uuid,uuid,uuid,boolean) to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke execute on function public.hotel_inquiry_snapshot_v1(uuid,uuid,uuid,boolean) from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'alter function public.hotel_inquiry_auto_close_v1(integer) set search_path=public' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'alter function public.hotel_inquiry_auto_close_v1(integer) set search_path=pg_catalog' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant execute on function public.hotel_inquiry_auto_close_v1(integer) to gw_runtime_probe with grant option' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke grant option for execute on function public.hotel_inquiry_auto_close_v1(integer) from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'grant execute on function public.hotel_inquiry_idempotency_begin_v1(uuid,uuid,text,text,text,text) to gw_runtime_probe' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'revoke execute on function public.hotel_inquiry_idempotency_begin_v1(uuid,uuid,text,text,text,text) from gw_runtime_probe' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'alter table public.hotel_inquiry_status_history disable trigger inquiry_status_append_only' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'alter table public.hotel_inquiry_status_history enable trigger inquiry_status_append_only' >/dev/null
  assert_schema_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'drop trigger hotel_inquiry_seed_categories_after_company on public.companies' >/dev/null
  assert_schema_not_ready "$probe_url"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -c \
    'create trigger hotel_inquiry_seed_categories_after_company after insert on public.companies for each row execute function public.hotel_inquiry_seed_categories_v1()' >/dev/null
  assert_schema_ready "$probe_url"
  printf 'HOTEL_OWNER_INQUIRIES_READINESS_DAMAGE_OK\n'
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
REPAIR_DIRECT_RECORD_INITIALIZATION_MIGRATION="$ROOT_DIR/packages/db/migrations/0047_repair_direct_record_initialization.sql"
REPAIR_VISIT_TRIGGER_DEFINER_MIGRATION="$ROOT_DIR/packages/db/migrations/0048_repair_visit_trigger_definer.sql"
HOTEL_OPERATIONAL_ISSUES_MIGRATION="$ROOT_DIR/packages/db/migrations/0049_hotel_operational_issues.sql"
HOTEL_DAILY_SALES_MIGRATION="$ROOT_DIR/packages/db/migrations/0050_hotel_daily_sales.sql"
FILE_SCANNER_AGENT_AUTHORITY_MIGRATION="$ROOT_DIR/packages/db/migrations/0051_file_scanner_agent_authority.sql"
HOTEL_OWNER_INQUIRIES_MIGRATION="$ROOT_DIR/packages/db/migrations/0052_hotel_owner_inquiries.sql"
FILE_SCANNER_AGENT_AUTHORITY_CORRECTION_MIGRATION="$ROOT_DIR/packages/db/migrations/0053_file_scanner_agent_authority_correction.sql"
FILE_UPLOAD_POLLING_SCOPE_CORRECTION_MIGRATION="$ROOT_DIR/packages/db/migrations/0054_file_upload_polling_scope_correction.sql"
HOTEL_INQUIRY_LIST_PROJECTION_CORRECTION_MIGRATION="$ROOT_DIR/packages/db/migrations/0055_hotel_inquiry_list_projection_correction.sql"
COMMON_IN_APP_NOTIFICATIONS_MIGRATION="$ROOT_DIR/packages/db/migrations/0056_common_in_app_notifications.sql"
COMMON_IN_APP_NOTIFICATION_INDEXES_MIGRATION="$ROOT_DIR/packages/db/migrations/0057_common_in_app_notification_indexes.sql"
HOTEL_KNOWLEDGE_BANK_MIGRATION="$ROOT_DIR/packages/db/migrations/0058_hotel_knowledge_bank.sql"
HOTEL_KNOWLEDGE_ATTACHMENTS_MIGRATION="$ROOT_DIR/packages/db/migrations/0059_hotel_knowledge_attachments.sql"
COMMON_IN_APP_NOTIFICATIONS_TEST_SQL="$ROOT_DIR/packages/db/test/common-notifications-integration.sql"
FILE_SCANNER_AGENT_AUTHORITY_TEST_SQL="$ROOT_DIR/packages/db/test/file-scanner-agent-authority-integration.sql"
GOOGLE_CALENDAR_REMOVAL_TEST_SQL="$ROOT_DIR/packages/db/test/google-calendar-removal-integration.sql"
GOOGLE_CALENDAR_DECOMMISSION_SCRIPT="$ROOT_DIR/scripts/decommission-google-calendar-preview.mjs"
HOTEL_CALENDAR_READ_MODEL_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-calendar-read-model-integration.sql"
HOTEL_REPAIR_LIFECYCLE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-repair-lifecycle-integration.sql"
HOTEL_REPAIR_PRIVATE_EVIDENCE_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-repair-private-evidence-integration.sql"
HOTEL_OPERATIONAL_ISSUES_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-operational-issues-integration.sql"
HOTEL_DAILY_SALES_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-daily-sales-integration.sql"
HOTEL_OWNER_INQUIRIES_TEST_SQL="$ROOT_DIR/packages/db/test/hotel-owner-inquiries-integration.sql"
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
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$REPAIR_DIRECT_RECORD_INITIALIZATION_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$REPAIR_VISIT_TRIGGER_DEFINER_MIGRATION" >/dev/null 2>&1
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
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$REPAIR_DIRECT_RECORD_INITIALIZATION_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$REPAIR_VISIT_TRIGGER_DEFINER_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_OPERATIONAL_ISSUES_MIGRATION" >/dev/null
HOTEL_OPERATIONAL_ISSUES_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_OPERATIONAL_ISSUES_TEST_SQL")"
if [[ "$HOTEL_OPERATIONAL_ISSUES_RESULT" != *"HOTEL_OPERATIONAL_ISSUES_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$HOTEL_OPERATIONAL_ISSUES_RESULT" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_DAILY_SALES_MIGRATION" >/dev/null
HOTEL_DAILY_SALES_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_DAILY_SALES_TEST_SQL")"
if [[ "$HOTEL_DAILY_SALES_RESULT" != *"HOTEL_DAILY_SALES_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$HOTEL_DAILY_SALES_RESULT" >&2
  exit 1
fi
assert_daily_sales_readiness_damage "$ADMIN_URL" "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$FILE_SCANNER_AGENT_AUTHORITY_MIGRATION" >/dev/null
grant_repair_lifecycle_capabilities "$ADMIN_URL"
FILE_SCANNER_AGENT_AUTHORITY_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$FILE_SCANNER_AGENT_AUTHORITY_TEST_SQL")"
if [[ "$FILE_SCANNER_AGENT_AUTHORITY_RESULT" != *"FILE_SCANNER_AGENT_AUTHORITY_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$FILE_SCANNER_AGENT_AUTHORITY_RESULT" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" >/dev/null <<'SQL'
do $contract_scanner_authority$
declare capability_role record;
begin
  for capability_role in
    select role_name from public.runtime_database_capabilities
    where capability = 'RECONCILER'
  loop
    execute format('revoke execute on function public.hotel_file_scan_command_v1(uuid,text,text,bigint,jsonb,uuid) from %I', capability_role.role_name);
    execute format('revoke execute on function public.hotel_file_scan_candidates_v1(integer) from %I', capability_role.role_name);
  end loop;
  delete from public.hotel_file_finalizer_capabilities finalizer
  using public.runtime_database_capabilities capability
  where capability.role_name = finalizer.role_name
    and capability.capability = 'RECONCILER';
end
$contract_scanner_authority$;
SQL
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_OWNER_INQUIRIES_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$FILE_SCANNER_AGENT_AUTHORITY_CORRECTION_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$FILE_UPLOAD_POLLING_SCOPE_CORRECTION_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_INQUIRY_LIST_PROJECTION_CORRECTION_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$COMMON_IN_APP_NOTIFICATIONS_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$COMMON_IN_APP_NOTIFICATION_INDEXES_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -c "create table public.hotel_knowledge_entries(id uuid)" >/dev/null
assert_schema_not_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -c "drop table public.hotel_knowledge_entries" >/dev/null
assert_schema_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_KNOWLEDGE_BANK_MIGRATION" >/dev/null
assert_schema_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -c "delete from public.hotel_file_scanner_agent_capabilities where role_name=session_user;delete from public.runtime_database_capabilities where role_name=session_user and capability='API_RUNTIME'" >/dev/null
PRE_KNOWLEDGE_API_PROBE_URL="$(configure_api_probe_role "$ADMIN_URL")"
grant_global_api_probe_table_capabilities "$ADMIN_URL"
grant_checklist_v2_api_capabilities "$ADMIN_URL"
grant_facility_execution_capabilities "$ADMIN_URL"
grant_repair_lifecycle_capabilities "$ADMIN_URL"
grant_global_api_probe_capabilities "$ADMIN_URL"
grant_inquiry_api_probe_capabilities "$ADMIN_URL"
grant_knowledge_core_api_probe_capabilities "$ADMIN_URL"
READINESS_SECOND_PROBE_URL="$PRE_KNOWLEDGE_API_PROBE_URL"
export READINESS_SECOND_PROBE_URL
assert_knowledge_attachments_pre_expand_parent_readiness_damage "$ADMIN_URL" "$PROBE_URL"
unset READINESS_SECOND_PROBE_URL
cleanup_api_probe_role "$ADMIN_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -c "insert into public.runtime_database_capabilities(role_name,capability)values(session_user,'API_RUNTIME')on conflict(role_name)do update set capability=excluded.capability;insert into public.hotel_file_scanner_agent_capabilities(role_name)values(session_user)on conflict(role_name)do nothing" >/dev/null
assert_schema_ready "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_KNOWLEDGE_ATTACHMENTS_MIGRATION" >/dev/null
assert_schema_ready "$PROBE_URL"
KNOWLEDGE_ATTACHMENT_MARKER_COUNT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -c "select count(*) from public.schema_migrations where version='0059_hotel_knowledge_attachments'")"
if [[ "$KNOWLEDGE_ATTACHMENT_MARKER_COUNT" != "1" ]]; then
  echo "knowledge attachment migration marker read-back failed" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -c "delete from public.hotel_file_scanner_agent_capabilities where role_name=session_user; delete from public.runtime_database_capabilities where role_name=session_user and capability='API_RUNTIME'" >/dev/null
KNOWLEDGE_API_PROBE_URL="$(configure_api_probe_role "$ADMIN_URL")"
grant_global_api_probe_table_capabilities "$ADMIN_URL"
grant_checklist_v2_api_capabilities "$ADMIN_URL"
grant_facility_execution_capabilities "$ADMIN_URL"
grant_repair_lifecycle_capabilities "$ADMIN_URL"
grant_global_api_probe_capabilities "$ADMIN_URL"
grant_inquiry_api_probe_capabilities "$ADMIN_URL"
grant_knowledge_api_probe_capabilities "$ADMIN_URL"
READINESS_SECOND_PROBE_URL="$KNOWLEDGE_API_PROBE_URL"
export READINESS_SECOND_PROBE_URL
assert_knowledge_core_readiness_damage "$ADMIN_URL" "$PROBE_URL"
assert_knowledge_attachments_readiness_damage "$ADMIN_URL" "$PROBE_URL"
unset READINESS_SECOND_PROBE_URL
run_hotel_knowledge_bank_integration "$ADMIN_URL" "$KNOWLEDGE_API_PROBE_URL" "$PROBE_URL"
cleanup_api_probe_role "$ADMIN_URL"
register_owner_api_capability "$ADMIN_URL"
grant_repair_lifecycle_capabilities "$ADMIN_URL"
HOTEL_OWNER_INQUIRIES_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$HOTEL_OWNER_INQUIRIES_TEST_SQL")"
if [[ "$HOTEL_OWNER_INQUIRIES_RESULT" != *"HOTEL_OWNER_INQUIRIES_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$HOTEL_OWNER_INQUIRIES_RESULT" >&2
  exit 1
fi
COMMON_IN_APP_NOTIFICATIONS_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_URL" -f "$COMMON_IN_APP_NOTIFICATIONS_TEST_SQL")"
if [[ "$COMMON_IN_APP_NOTIFICATIONS_RESULT" != *"COMMON_IN_APP_NOTIFICATIONS_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$COMMON_IN_APP_NOTIFICATIONS_RESULT" >&2
  exit 1
fi
grant_repair_lifecycle_capabilities "$ADMIN_URL"
assert_owner_inquiries_readiness_damage "$ADMIN_URL" "$PROBE_URL"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$HOTEL_CALENDAR_READ_MODEL_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_URL" -f "$SCHEDULED_RECONCILER_LOCK_MIGRATION" >/dev/null
grant_repair_lifecycle_capabilities "$ADMIN_URL"
assert_schema_ready "$PROBE_URL"
assert_operational_issue_readiness_damage "$ADMIN_URL" "$PROBE_URL"
assert_scheduled_reconciler_lock_runtime "$PROBE_URL"
run_actual_repair_api_probe "$ADMIN_URL"
run_actual_operational_issue_api_probe "$ADMIN_URL"
run_actual_daily_sales_api_probe "$ADMIN_URL"
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
