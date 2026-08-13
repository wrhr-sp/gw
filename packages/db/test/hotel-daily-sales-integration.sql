\set ON_ERROR_STOP on

begin;

do $fixture$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_internal_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_internal uuid;
  v_housekeeping uuid;
  v_owner uuid;
  v_permission text;
  v_index integer;
begin
  select user_id into strict v_internal from public.auth_sessions where company_id=v_company and id=v_internal_session;
  select user_id into strict v_housekeeping from public.auth_sessions where company_id=v_company and id='d9130000-0000-4000-8000-000000000001';
  select user_id into strict v_owner from public.auth_sessions where company_id=v_company and id='d9230000-0000-4000-8000-000000000001';

  insert into public.hotel_sales_categories(id,company_id,branch_id,name,display_order,created_by) values
   ('da510000-0000-4000-8000-000000000001',v_company,v_hotel,'객실매출',0,v_internal),
   ('da510000-0000-4000-8000-000000000002',v_company,v_hotel,'부대매출',1,v_internal);
  insert into public.hotel_payment_methods(id,company_id,branch_id,name,display_order,created_by) values
   ('da520000-0000-4000-8000-000000000001',v_company,v_hotel,'카드',0,v_internal),
   ('da520000-0000-4000-8000-000000000002',v_company,v_hotel,'현금',1,v_internal);

  v_index:=0;
  foreach v_permission in array array['HOTEL_SALES_VIEW','HOTEL_SALES_MANAGE','HOTEL_SALES_CONFIRM','HOTEL_SALES_CORRECT'] loop
    v_index:=v_index+1;
    insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
    values(('da540000-0000-4000-8000-'||lpad(v_index::text,12,'0'))::uuid,v_company,v_hotel,'USER',v_internal,v_permission,'ALLOW',statement_timestamp()-interval '1 day',v_internal,'일매출 통합검증 권한');
  end loop;
  insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
  values('da541000-0000-4000-8000-000000000001',v_company,v_hotel,'USER',v_owner,'HOTEL_OWNER_SALES_READ','ALLOW',statement_timestamp()-interval '1 day',v_internal,'소유주 확정매출 조회');
  insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason) values
   ('da541000-0000-4000-8000-000000000002',v_company,v_hotel,'USER',v_owner,'HOTEL_FILE_READ','ALLOW',statement_timestamp()-interval '1 day',v_internal,'소유주 매출증빙 조회'),
   ('da541000-0000-4000-8000-000000000003',v_company,v_hotel,'USER',v_internal,'HOTEL_FILE_READ','ALLOW',statement_timestamp()-interval '1 day',v_internal,'사내 매출증빙 조회');
  v_index:=0;
  foreach v_permission in array array['HOTEL_SALES_VIEW','HOTEL_SALES_MANAGE','HOTEL_SALES_CONFIRM','HOTEL_SALES_CORRECT'] loop
    v_index:=v_index+1;
    insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
    values(('da542000-0000-4000-8000-'||lpad(v_index::text,12,'0'))::uuid,v_company,v_hotel,'USER',v_housekeeping,v_permission,'ALLOW',statement_timestamp()-interval '1 day',v_internal,'하우스키핑 오배정 격리 검증');
  end loop;
end
$fixture$;
commit;

do $journey$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_internal_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_owner_session uuid := 'd9230000-0000-4000-8000-000000000001';
  v_housekeeping_session uuid := 'd9130000-0000-4000-8000-000000000001';
  v_internal_token text := repeat('I',43);
  v_owner_token text := repeat('O',43);
  v_housekeeping_token text := repeat('H',43);
  v_internal uuid;
  v_sales uuid := 'da500000-0000-4000-8000-000000000001';
  v_result record;
  v_version integer;
  v_upload uuid;
  v_file uuid;
  v_count integer;
  v_before_lines jsonb;
  v_before_totals jsonb;
begin
  select user_id into strict v_internal from public.auth_sessions where company_id=v_company and id=v_internal_session;
  perform set_config('app.company_id',v_company::text,true);
  perform set_config('app.session_id',v_internal_session::text,true);

  select * into v_result from public.hotel_daily_sales_capabilities_v1(v_company,v_internal_token);
  if v_result.command_status<>'OK' or not exists(select 1 from jsonb_array_elements(v_result.result_snapshot->'hotels') h where h->>'hotelId'=v_hotel::text and (h->>'canManage')::boolean and (h->>'canConfirm')::boolean and (h->>'canCorrect')::boolean and not (h->>'ownerView')::boolean) then raise exception 'daily sales capabilities failed: %',v_result.command_status; end if;

  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'CREATE',0,
    jsonb_build_object('businessDate','2026-08-13','memo','최초 임시저장','lines',jsonb_build_array(jsonb_build_object('categoryId','da510000-0000-4000-8000-000000000001','paymentMethodId','da520000-0000-4000-8000-000000000001','grossAmount',150000,'discountAmount',10000,'refundAmount',5000,'refundReason','고객 요청 당일 환불'))),
    v_internal_token,gen_random_uuid(),'sales-create-1','POST','/api/hotels/'||v_hotel||'/daily-sales','sales-create-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'CREATED' or v_result.result_snapshot->>'status'<>'DRAFT' or v_result.result_snapshot#>>'{totals,netAmount}'<>'135000' then raise exception 'daily sales create failed: % %',v_result.command_status,v_result.result_snapshot; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;

  select * into v_result from public.hotel_repair_file_upload_init_v1(
    v_company,v_hotel,'da550000-0000-4000-8000-000000000099','UPLOAD_INIT',0,
    jsonb_build_object('parentType','DAILY_SALES_EVIDENCE','dailySalesId',v_sales,'fileName','업로드검증.png','mimeType','image/png','sizeBytes',100,'quarantineObjectKey','quarantine/da550000-0000-4000-8000-000000000099/'||repeat('A',43),'reservationFingerprint',repeat('a',64)),
    v_internal_token,gen_random_uuid(),'sales-upload-init-1','POST','/api/hotels/'||v_hotel||'/files/uploads','sales-upload-init-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'CREATED' or not exists(select 1 from public.hotel_file_uploads where company_id=v_company and branch_id=v_hotel and id='da550000-0000-4000-8000-000000000099' and parent_type='DAILY_SALES_EVIDENCE' and daily_sales_id=v_sales and status='PENDING_UPLOAD') then raise exception 'daily sales upload init failed: % %',v_result.command_status,v_result.result_snapshot; end if;
  delete from public.idempotency_records where company_id=v_company and idempotency_key='sales-upload-init-1';
  delete from public.hotel_file_uploads where company_id=v_company and id='da550000-0000-4000-8000-000000000099';

  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'CREATE',0,
    jsonb_build_object('businessDate','2026-08-13','memo',null,'lines',jsonb_build_array(jsonb_build_object('categoryId','da510000-0000-4000-8000-000000000001','paymentMethodId','da520000-0000-4000-8000-000000000001','grossAmount',1,'discountAmount',0,'refundAmount',0,'refundReason',null))),
    v_internal_token,gen_random_uuid(),'sales-duplicate-1','POST','/api/hotels/'||v_hotel||'/daily-sales','sales-duplicate-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'HOTEL_SALES_DUPLICATE_DATE' then raise exception 'duplicate business date accepted'; end if;

  select public.hotel_daily_sales_snapshot_v1(v_company,v_hotel,v_sales,true)->'lines', public.hotel_daily_sales_snapshot_v1(v_company,v_hotel,v_sales,true)->'totals'
    into v_before_lines,v_before_totals;
  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'UPDATE',v_version,
    jsonb_build_object('memo','부분저장 금지 검증','lines',jsonb_build_array(
      jsonb_build_object('categoryId','da510000-0000-4000-8000-000000000002','paymentMethodId','da520000-0000-4000-8000-000000000002','grossAmount',300000,'discountAmount',0,'refundAmount',0,'refundReason',null),
      jsonb_build_object('categoryId','da510000-0000-4000-8000-999999999999','paymentMethodId','da520000-0000-4000-8000-000000000001','grossAmount',1,'discountAmount',0,'refundAmount',0,'refundReason',null))),
    v_internal_token,gen_random_uuid(),'sales-invalid-second-line','PATCH','/api/hotels/'||v_hotel||'/daily-sales/'||v_sales,'sales-invalid-second-line-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'VALIDATION_ERROR' then raise exception 'invalid second line accepted: %',v_result.command_status; end if;
  if (select version from public.hotel_daily_sales where company_id=v_company and id=v_sales)<>v_version
     or public.hotel_daily_sales_snapshot_v1(v_company,v_hotel,v_sales,true)->'lines'<>v_before_lines
     or public.hotel_daily_sales_snapshot_v1(v_company,v_hotel,v_sales,true)->'totals'<>v_before_totals then
    raise exception 'failed update partially mutated daily sales';
  end if;

  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'UPDATE',v_version,
    jsonb_build_object('memo','수정 임시저장','lines',jsonb_build_array(jsonb_build_object('categoryId','da510000-0000-4000-8000-000000000001','paymentMethodId','da520000-0000-4000-8000-000000000001','grossAmount',200000,'discountAmount',10000,'refundAmount',5000,'refundReason','고객 요청 당일 환불'))),
    v_internal_token,gen_random_uuid(),'sales-update-1','PATCH','/api/hotels/'||v_hotel||'/daily-sales/'||v_sales,'sales-update-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot#>>'{totals,netAmount}'<>'185000' then raise exception 'draft update failed'; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;

  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'CONFIRM',v_version,jsonb_build_object('evidenceFileVersionIds','[]'::jsonb),v_internal_token,gen_random_uuid(),'sales-confirm-no-evidence','POST','/api/hotels/'||v_hotel||'/daily-sales/'||v_sales||'/confirm','sales-confirm-no-evidence-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'HOTEL_SALES_EVIDENCE_REQUIRED' then raise exception 'confirmation without evidence accepted'; end if;

  insert into public.hotel_daily_sales(id,company_id,branch_id,business_date,created_by)
  values('da500000-0000-4000-8000-000000000099',v_company,v_hotel,'2199-12-31',v_internal);
  insert into public.hotel_file_uploads(id,company_id,branch_id,parent_type,daily_sales_id,display_name,declared_mime,reserved_size,quarantine_object_key,reservation_fingerprint,status,source_etag,source_object_version,initiated_by,initiated_session_id,expires_at)
  values('da550000-0000-4000-8000-000000000099',v_company,v_hotel,'DAILY_SALES_EVIDENCE','da500000-0000-4000-8000-000000000099','타 일매출 증빙.png','image/png',100,'quarantine/da550000-0000-4000-8000-000000000099/'||repeat('A',43),repeat('9',64),'READY_UNLINKED','"99999999999999999999999999999999"','source-v1',v_internal,v_internal_session,statement_timestamp()+interval '1 hour');
  insert into public.hotel_file_versions(id,company_id,branch_id,upload_id,clean_object_key,clean_etag,clean_object_version,clean_sha256,clean_size,detected_mime,display_name,exif_location_removed,original_retention_until)
  values('da560000-0000-4000-8000-000000000099',v_company,v_hotel,'da550000-0000-4000-8000-000000000099','clean/da560000-0000-4000-8000-000000000099','"99999999999999999999999999999999"','clean-v1',decode(repeat('99',32),'hex'),100,'image/png','타 일매출 증빙.png',true,statement_timestamp()+interval '5 years');
  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'CONFIRM',v_version,jsonb_build_object('evidenceFileVersionIds',jsonb_build_array('da560000-0000-4000-8000-000000000099')),v_internal_token,gen_random_uuid(),'sales-confirm-foreign-evidence','POST','/api/hotels/'||v_hotel||'/daily-sales/'||v_sales||'/confirm','sales-confirm-foreign-evidence-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'HOTEL_SALES_EVIDENCE_REQUIRED'
     or (select status from public.hotel_daily_sales where company_id=v_company and id=v_sales)<>'DRAFT'
     or (select status from public.hotel_file_uploads where company_id=v_company and id='da550000-0000-4000-8000-000000000099')<>'READY_UNLINKED' then
    raise exception 'foreign daily sales evidence was accepted or mutated: %',v_result.command_status;
  end if;

  for v_count in 1..2 loop
    v_upload:=('da550000-0000-4000-8000-'||lpad(v_count::text,12,'0'))::uuid;
    v_file:=('da560000-0000-4000-8000-'||lpad(v_count::text,12,'0'))::uuid;
    insert into public.hotel_file_uploads(id,company_id,branch_id,parent_type,daily_sales_id,display_name,declared_mime,reserved_size,quarantine_object_key,reservation_fingerprint,status,source_etag,source_object_version,initiated_by,initiated_session_id,expires_at)
    values(v_upload,v_company,v_hotel,'DAILY_SALES_EVIDENCE',v_sales,case when v_count=1 then '마감증빙.png' else '정정증빙.png' end,'image/png',100,'quarantine/'||v_upload||'/'||repeat('A',43),repeat(v_count::text,64),'READY_UNLINKED','"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"','source-v1',v_internal,v_internal_session,statement_timestamp()+interval '1 hour');
    insert into public.hotel_file_versions(id,company_id,branch_id,upload_id,clean_object_key,clean_etag,clean_object_version,clean_sha256,clean_size,detected_mime,display_name,exif_location_removed,original_retention_until)
    values(v_file,v_company,v_hotel,v_upload,'clean/'||v_file,'"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"','clean-v1',decode(repeat('ab',32),'hex'),100,'image/png',case when v_count=1 then '마감증빙.png' else '정정증빙.png' end,true,statement_timestamp()+interval '5 years');
    insert into public.outbox_jobs(id,company_id,branch_id,job_type,payload,status,attempt_count,available_at,completed_at)
    values(('da571000-0000-4000-8000-'||lpad(v_count::text,12,'0'))::uuid,v_company,v_hotel,'HOTEL_FILE_SCAN',jsonb_build_object('uploadId',v_upload),'SUCCEEDED',1,statement_timestamp(),statement_timestamp());
    insert into public.hotel_file_scan_jobs(id,company_id,branch_id,upload_id,dispatch_job_id,status,attempt_count,file_version_id,clean_object_key,completed_at)
    values(('da570000-0000-4000-8000-'||lpad(v_count::text,12,'0'))::uuid,v_company,v_hotel,v_upload,('da571000-0000-4000-8000-'||lpad(v_count::text,12,'0'))::uuid,'COMPLETED',1,v_file,'clean/'||v_file,statement_timestamp());
  end loop;

  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'CONFIRM',v_version,jsonb_build_object('evidenceFileVersionIds',jsonb_build_array('da560000-0000-4000-8000-000000000001')),v_internal_token,gen_random_uuid(),'sales-confirm-1','POST','/api/hotels/'||v_hotel||'/daily-sales/'||v_sales||'/confirm','sales-confirm-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot->>'status'<>'LOCKED' or jsonb_array_length(v_result.result_snapshot->'evidence')<>1 then raise exception 'daily sales confirm failed: % %',v_result.command_status,v_result.result_snapshot; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;

  select * into v_result from public.hotel_repair_file_upload_init_v1(
    v_company,v_hotel,'da550000-0000-4000-8000-000000000098','UPLOAD_INIT',0,
    jsonb_build_object('parentType','DAILY_SALES_EVIDENCE','dailySalesId',v_sales,'fileName','정정업로드검증.png','mimeType','image/png','sizeBytes',100,'quarantineObjectKey','quarantine/da550000-0000-4000-8000-000000000098/'||repeat('B',43),'reservationFingerprint',repeat('b',64)),
    v_internal_token,gen_random_uuid(),'sales-correction-upload-init-1','POST','/api/hotels/'||v_hotel||'/files/uploads','sales-correction-upload-init-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'CREATED' or not exists(select 1 from public.hotel_file_uploads where company_id=v_company and branch_id=v_hotel and id='da550000-0000-4000-8000-000000000098' and parent_type='DAILY_SALES_EVIDENCE' and daily_sales_id=v_sales and status='PENDING_UPLOAD') then raise exception 'locked daily sales correction upload init failed: % %',v_result.command_status,v_result.result_snapshot; end if;
  delete from public.idempotency_records where company_id=v_company and idempotency_key='sales-correction-upload-init-1';
  delete from public.hotel_file_uploads where company_id=v_company and id='da550000-0000-4000-8000-000000000098';

  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'UPDATE',v_version,jsonb_build_object('memo','잠금 뒤 수정','lines',jsonb_build_array(jsonb_build_object('categoryId','da510000-0000-4000-8000-000000000001','paymentMethodId','da520000-0000-4000-8000-000000000001','grossAmount',1,'discountAmount',0,'refundAmount',0,'refundReason',null))),v_internal_token,gen_random_uuid(),'sales-locked-update','PATCH','/api/hotels/'||v_hotel||'/daily-sales/'||v_sales,'sales-locked-update-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'HOTEL_SALES_LOCKED' then raise exception 'locked original was mutable'; end if;

  select * into v_result from public.hotel_daily_sales_command_v1(v_company,v_hotel,v_sales,'CORRECT',v_version,
    jsonb_build_object('reason','현금매출 누락 정정','evidenceFileVersionIds',jsonb_build_array('da560000-0000-4000-8000-000000000002'),'memo','정정 완료','lines',jsonb_build_array(jsonb_build_object('categoryId','da510000-0000-4000-8000-000000000001','paymentMethodId','da520000-0000-4000-8000-000000000001','grossAmount',210000,'discountAmount',10000,'refundAmount',5000,'refundReason','고객 요청 당일 환불'))),
    v_internal_token,gen_random_uuid(),'sales-correct-1','POST','/api/hotels/'||v_hotel||'/daily-sales/'||v_sales||'/corrections','sales-correct-hash',gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot#>>'{totals,netAmount}'<>'195000' or jsonb_array_length(v_result.result_snapshot->'corrections')<>1 then raise exception 'daily sales correction failed: % %',v_result.command_status,v_result.result_snapshot; end if;
  if not exists(select 1 from public.hotel_daily_sales_versions where company_id=v_company and sales_id=v_sales and action='CONFIRM') or not exists(select 1 from public.hotel_daily_sales_versions where company_id=v_company and sales_id=v_sales and action='CORRECT') or not exists(select 1 from public.audit_events where company_id=v_company and resource_id=v_sales and event_code='HOTEL_DAILY_SALES_CORRECT') then raise exception 'immutable version or audit missing'; end if;

  delete from public.hotel_file_access_rate_windows
   where company_id=v_company and branch_id=v_hotel
     and window_started_at=date_bin(interval '5 minutes',statement_timestamp(),timestamptz '1970-01-01 00:00:00+00');

  select * into v_result from public.hotel_daily_sales_file_view_command_v1(v_company,v_hotel,v_sales,'da560000-0000-4000-8000-000000000002','AUTHORIZE',v_internal_token,'da580000-0000-4000-8000-000000000001',repeat('V',43),gen_random_uuid(),gen_random_uuid(),'da590000-0000-4000-8000-000000000001');
  if v_result.command_status<>'OK' or v_result.result_snapshot->>'displayName'<>'정정증빙.png' then raise exception 'internal daily sales evidence view denied: % %',v_result.command_status,v_result.result_snapshot; end if;
  select * into v_result from public.hotel_daily_sales_file_view_command_v1(v_company,v_hotel,v_sales,'da560000-0000-4000-8000-000000000002','SUCCEEDED',v_internal_token,'da580000-0000-4000-8000-000000000001',repeat('V',43),gen_random_uuid(),gen_random_uuid(),'da590000-0000-4000-8000-000000000001');
  if v_result.command_status<>'RECORDED' then raise exception 'daily sales evidence terminal audit failed'; end if;

  perform set_config('app.session_id',v_owner_session::text,true);
  select * into v_result from public.hotel_daily_sales_read_v1(v_company,v_hotel,null,jsonb_build_object('references','true'),v_owner_token);
  if v_result.command_status<>'OK' or jsonb_array_length(v_result.result_snapshot->'categories')<1 or jsonb_array_length(v_result.result_snapshot->'paymentMethods')<1 then raise exception 'owner reference projection unavailable: % %',v_result.command_status,v_result.result_snapshot; end if;
  select * into v_result from public.hotel_daily_sales_read_v1(v_company,v_hotel,v_sales,'{}'::jsonb,v_owner_token);
  if v_result.command_status<>'OK' or v_result.result_snapshot->>'status'<>'LOCKED' or v_result.result_snapshot ? 'internalMemo' or v_result.result_snapshot ? 'createdBy' then raise exception 'owner projection leaked private fields: %',v_result.result_snapshot; end if;
  select * into v_result from public.hotel_daily_sales_file_view_command_v1(v_company,v_hotel,v_sales,'da560000-0000-4000-8000-000000000002','AUTHORIZE',v_owner_token,'da580000-0000-4000-8000-000000000002',repeat('W',43),gen_random_uuid(),gen_random_uuid(),'da590000-0000-4000-8000-000000000002');
  if v_result.command_status<>'OK' then raise exception 'owner daily sales evidence view denied: %',v_result.command_status; end if;

  perform set_config('app.session_id',v_housekeeping_session::text,true);
  select * into v_result from public.hotel_daily_sales_read_v1(v_company,v_hotel,v_sales,'{}'::jsonb,v_housekeeping_token);
  if v_result.command_status<>'FORBIDDEN' then raise exception 'housekeeping sales access was not blocked'; end if;
  select * into v_result from public.hotel_daily_sales_file_view_command_v1(v_company,v_hotel,v_sales,'da560000-0000-4000-8000-000000000002','AUTHORIZE',v_housekeeping_token,gen_random_uuid(),repeat('X',43),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
  if v_result.command_status<>'FORBIDDEN' then raise exception 'housekeeping sales evidence view was not blocked'; end if;
end
$journey$;

select 'HOTEL_DAILY_SALES_INTEGRATION_OK';
