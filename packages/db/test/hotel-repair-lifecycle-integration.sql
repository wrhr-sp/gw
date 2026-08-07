\set ON_ERROR_STOP on

begin;
set constraints all deferred;

do $repair_fixture$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_actor uuid;
  v_definition uuid := 'ab000000-0000-4000-8000-000000000001';
  v_revision uuid := 'ab000000-0000-4000-8000-000000000002';
  v_stage uuid := 'ab000000-0000-4000-8000-000000000003';
  v_priority uuid := 'ab000000-0000-4000-8000-000000000004';

  v_permission text;
  v_index integer := 0;
begin
  select session_record.user_id into strict v_actor
    from public.auth_sessions session_record
   where session_record.company_id=v_company and session_record.id=v_session;

  insert into public.process_definitions(
    id,company_id,branch_id,application_type,scope,name,current_revision_id,
    version,created_by,updated_by
  ) values (
    v_definition,v_company,v_hotel,'REPAIR_CASE','HOTEL','보수 통합 검토',null,
    1,v_actor,v_actor
  );
  insert into public.process_definition_revisions(
    id,company_id,definition_id,version,start_stage_key,reason,created_by
  ) values (
    v_revision,v_company,v_definition,1,'REPAIR_REVIEW','보수 통합 검토 최초 revision',v_actor
  );
  insert into public.process_stage_snapshots(
    id,company_id,revision_id,stage_key,stage_name,reviewer_user_id,
    delegate_user_id,delegate_starts_at,delegate_ends_at,due_amount,due_unit,is_final
  ) values (
    v_stage,v_company,v_revision,'REPAIR_REVIEW','보수 결과 검토',v_actor,
    null,null,null,24,'HOURS',true
  );
  update public.process_definitions
     set current_revision_id=v_revision
   where company_id=v_company and id=v_definition;
  insert into public.hotel_process_defaults(
    company_id,branch_id,application_type,definition_id,revision_id,version,updated_by
  ) values (
    v_company,v_hotel,'REPAIR_CASE',v_definition,v_revision,1,v_actor
  );

  insert into public.hotel_repair_priorities(
    id,company_id,branch_id,name,sort_order,color,status,version,created_by,updated_by
  ) values (
    v_priority,v_company,v_hotel,'긴급',1,'RED','ACTIVE',1,v_actor,v_actor
  );
  insert into public.hotel_repair_priority_history(
    id,company_id,branch_id,priority_id,priority_version,action,reason,
    before_summary,after_summary,actor_user_id
  ) values (
    'ab000000-0000-4000-8000-000000000005',v_company,v_hotel,v_priority,1,'CREATED',
    '보수 실제 통합검증 우선순위',null,
    pg_catalog.jsonb_build_object('id',v_priority,'name','긴급','sortOrder',1,'color','RED','status','ACTIVE','version',1),
    v_actor
  );

  foreach v_permission in array array[
    'REPAIR_CREATE','REPAIR_READ','REPAIR_VISIT_CREATE','REPAIR_VISIT_UPDATE',
    'REPAIR_VISIT_DELETE','REPAIR_COMPLETE','REPAIR_REVIEW',
    'REPAIR_EXTERNAL_CONTACT_VIEW','HOTEL_FILE_READ','HOTEL_FILE_UPLOAD'
  ] loop
    v_index := v_index + 1;
    insert into public.permission_grants(
      id,company_id,branch_id,subject_type,subject_id,permission_code,effect,
      valid_from,valid_until,granted_by,reason
    ) values (
      ('ab100000-0000-4000-8000-' || lpad(v_index::text,12,'0'))::uuid,
      v_company,v_hotel,'USER',v_actor,v_permission,'ALLOW',
      now()-interval '1 day',null,v_actor,'보수 실제 통합검증 권한'
    );
  end loop;
end
$repair_fixture$;

commit;

do $repair_evidence_fixture$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_repair uuid := 'ac000000-0000-4000-8000-000000000001';
  v_upload uuid := 'ad000000-0000-4000-8000-000000000001';
  v_file_version uuid := 'ad000000-0000-4000-8000-000000000002';
  v_result record;
begin
  perform set_config('app.company_id',v_company::text,true);
  perform set_config('app.session_id',v_session::text,true);

  perform 1 from public.hotel_command_actor_v1(v_company,v_hotel,repeat('I',43),'REPAIR_CREATE',true);
  if not found then raise exception 'repair evidence fixture actor lacks REPAIR_CREATE'; end if;
  perform 1 from public.hotel_command_actor_v1(v_company,v_hotel,repeat('I',43),'HOTEL_FILE_UPLOAD',true);
  if not found then raise exception 'repair evidence fixture actor lacks HOTEL_FILE_UPLOAD'; end if;

  select * into v_result from public.hotel_repair_file_upload_init_v1(
    v_company,v_hotel,v_upload,'UPLOAD_INIT',0,
    pg_catalog.jsonb_build_object(
      'parentType','REPAIR_CASE_EVIDENCE','repairCaseId',v_repair,
      'repairVisitId',null,'fileName','보수-실제통합.jpg',
      'mimeType','image/jpeg','sizeBytes',12,
      'quarantineObjectKey','quarantine/'||v_upload::text||'/'||repeat('Q',43),
      'reservationFingerprint',repeat('d',64)
    ),repeat('I',43),gen_random_uuid(),'repair-evidence-init','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/files/upload-init',
    'repair-evidence-init-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'CREATED' then
    raise exception 'repair evidence init failed: % %',v_result.command_status,v_result.result_snapshot;
  end if;
  select * into v_result from public.hotel_file_command_v1(
    v_company,v_hotel,v_upload,'UPLOAD_COMPLETE',0,
    pg_catalog.jsonb_build_object(
      'etag','"dddddddddddddddddddddddddddddddd"','objectVersion','repair-version-1',
      'sizeBytes',12,'mimeType','image/jpeg','reservationFingerprint',repeat('d',64),
      'scanJobId',gen_random_uuid()
    ),repeat('I',43),gen_random_uuid(),'repair-evidence-complete','POST',
    '/api/files/complete','repair-evidence-complete-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' then
    raise exception 'repair evidence upload complete failed: % %',v_result.command_status,v_result.result_snapshot;
  end if;
  update public.hotel_file_scan_jobs
     set status='COMPLETED',scanner_sha256=decode(repeat('e',64),'hex'),
         detected_mime='image/jpeg',file_version_id=v_file_version,
         clean_object_key='clean/'||v_file_version::text,
         clean_etag='"ffffffffffffffffffffffffffffffff"',
         clean_object_version='repair-clean-version-1',
         clean_sha256=decode(repeat('f',64),'hex'),clean_size=10,
         completed_at=statement_timestamp(),updated_at=statement_timestamp()
   where company_id=v_company and branch_id=v_hotel and upload_id=v_upload;
  insert into public.hotel_file_versions(
    id,company_id,branch_id,upload_id,clean_object_key,clean_etag,
    clean_object_version,clean_sha256,clean_size,detected_mime,display_name,
    exif_location_removed,original_retention_until
  ) values (
    v_file_version,v_company,v_hotel,v_upload,'clean/'||v_file_version::text,
    '"ffffffffffffffffffffffffffffffff"','repair-clean-version-1',
    decode(repeat('f',64),'hex'),10,'image/jpeg','보수-실제통합.jpg',true,
    statement_timestamp()+interval '366 days'
  );
  update public.hotel_file_uploads
     set status='READY_UNLINKED',updated_at=statement_timestamp()
   where company_id=v_company and branch_id=v_hotel and id=v_upload;
end
$repair_evidence_fixture$;
select 'HOTEL_REPAIR_LIFECYCLE_FIXTURE_OK';
