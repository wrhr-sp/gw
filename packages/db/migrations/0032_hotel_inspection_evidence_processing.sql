-- Forward-only inspection evidence processing and immutable linkage hardening.
-- Existing migrations 0026, 0027 and 0031 remain immutable.

begin;

create function public.hotel_file_scan_candidates_v1(p_limit integer)
returns table (upload_id uuid)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.file_finalizer_has_capability()
     or p_limit is null
     or p_limit < 1 then
    return;
  end if;

  return query
  select job.upload_id
    from public.hotel_file_scan_jobs job
   where job.attempt_count < 5
     and job.available_at <= pg_catalog.statement_timestamp()
     and (
       job.status = 'PENDING'
       or (
         job.status in ('CLAIMED', 'CLEAN_PENDING_PROMOTION')
         and job.claim_expires_at <= pg_catalog.statement_timestamp()
       )
     )
   order by job.available_at, job.created_at, job.id
   limit least(p_limit, 25);
end
$function$;
revoke all on function public.hotel_file_scan_candidates_v1(integer) from public;

alter table public.hotel_file_links
  drop constraint hotel_file_links_company_id_file_version_id_key;
alter table public.hotel_file_links
  add constraint hotel_file_links_version_result_revision_key
  unique (company_id, file_version_id, result_id, result_version);

create function public.guard_hotel_file_link_parent_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
declare
  existing_link public.hotel_file_links%rowtype;
begin
  perform 1
    from public.hotel_file_versions version_record
   where version_record.company_id = new.company_id
     and version_record.id = new.file_version_id
   for update;

  select link.* into existing_link
    from public.hotel_file_links link
   where link.company_id = new.company_id
     and link.file_version_id = new.file_version_id
   order by link.linked_at, link.id
   limit 1;

  if found and existing_link.result_id is distinct from new.result_id then
    raise exception 'EVIDENCE_PARENT_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end
$function$;
revoke all on function public.guard_hotel_file_link_parent_v1() from public;

create trigger hotel_file_links_parent_guard
before insert on public.hotel_file_links
for each row execute function public.guard_hotel_file_link_parent_v1();

create trigger hotel_file_links_terminal_insert_guard
before insert on public.hotel_file_links
for each row execute function public.guard_inspection_terminal_mutation();

insert into public.schema_migrations(version)
values ('0032_hotel_inspection_evidence_processing')
on conflict (version) do nothing;

commit;
