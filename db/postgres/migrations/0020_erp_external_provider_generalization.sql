do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conrelid::regclass::text as table_name, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'erp_vendors'::regclass,
        'erp_expense_requests'::regclass,
        'erp_evidence'::regclass,
        'erp_billings'::regclass,
        'erp_payment_records'::regclass,
        'erp_accounting_mappings'::regclass,
        'erp_integration_events'::regclass
      )
      and pg_get_constraintdef(oid) like '%kyungrinara%'
  loop
    execute format('alter table %s drop constraint %I', constraint_record.table_name, constraint_record.conname);
  end loop;
end $$;

alter table erp_vendors add constraint erp_vendors_external_provider_check check (external_provider is null or external_provider in ('external_erp', 'kyungrinara'));
alter table erp_expense_requests add constraint erp_expense_requests_external_provider_check check (external_provider is null or external_provider in ('external_erp', 'kyungrinara'));
alter table erp_evidence add constraint erp_evidence_external_provider_check check (external_provider is null or external_provider in ('external_erp', 'kyungrinara'));
alter table erp_billings add constraint erp_billings_external_provider_check check (external_provider is null or external_provider in ('external_erp', 'kyungrinara'));
alter table erp_payment_records add constraint erp_payment_records_external_provider_check check (external_provider is null or external_provider in ('external_erp', 'kyungrinara'));
alter table erp_accounting_mappings add constraint erp_accounting_mappings_external_provider_check check (external_provider is null or external_provider in ('external_erp', 'kyungrinara'));
alter table erp_integration_events add constraint erp_integration_events_provider_check check (provider in ('external_erp', 'kyungrinara'));

update erp_vendors set external_provider = 'external_erp' where external_provider = 'kyungrinara';
update erp_expense_requests set external_provider = 'external_erp' where external_provider = 'kyungrinara';
update erp_evidence set external_provider = 'external_erp' where external_provider = 'kyungrinara';
update erp_billings set external_provider = 'external_erp' where external_provider = 'kyungrinara';
update erp_payment_records set external_provider = 'external_erp' where external_provider = 'kyungrinara';
update erp_accounting_mappings set external_provider = 'external_erp' where external_provider = 'kyungrinara';
update erp_integration_events set provider = 'external_erp' where provider = 'kyungrinara';
