-- Online indexes for the common in-app notification read model.
-- This file is intentionally non-transactional: PostgreSQL forbids CONCURRENTLY in a transaction.
-- A failed or invalid prior build is removed before retry; the marker is written only after all builds complete.

drop index concurrently if exists public.hotel_inquiry_notifications_recipient_recent_idx;
create index concurrently hotel_inquiry_notifications_recipient_recent_idx
 on public.hotel_inquiry_notifications(company_id,recipient_user_id,created_at desc,id);

drop index concurrently if exists public.hotel_inquiry_notifications_recipient_unread_idx;
create index concurrently hotel_inquiry_notifications_recipient_unread_idx
 on public.hotel_inquiry_notifications(company_id,recipient_user_id)
 where read_at is null;

drop index concurrently if exists public.hotel_issue_notification_outbox_recipient_recent_idx;
create index concurrently hotel_issue_notification_outbox_recipient_recent_idx
 on public.hotel_issue_notification_outbox(company_id,recipient_user_id,created_at desc,id)
 where channel='IN_APP';

drop index concurrently if exists public.hotel_issue_notification_outbox_recipient_unread_idx;
create index concurrently hotel_issue_notification_outbox_recipient_unread_idx
 on public.hotel_issue_notification_outbox(company_id,recipient_user_id)
 where channel='IN_APP' and read_at is null;

insert into public.schema_migrations(version)
values('0057_common_in_app_notification_indexes')
on conflict(version) do nothing;
