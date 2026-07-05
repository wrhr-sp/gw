-- Messenger search and mentions foundation

create table if not exists messenger_message_mentions (
  company_id text not null,
  room_id text not null,
  message_id text not null,
  mentioned_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (company_id, message_id, mentioned_user_id),
  foreign key (company_id, room_id) references messenger_rooms(company_id, id) on delete cascade,
  foreign key (company_id, message_id) references messenger_messages(company_id, id) on delete cascade,
  foreign key (company_id, room_id, mentioned_user_id) references messenger_room_members(company_id, room_id, user_id) on delete cascade
);

create index if not exists idx_messenger_message_mentions_user
  on messenger_message_mentions(company_id, mentioned_user_id, created_at desc);

create index if not exists idx_messenger_message_mentions_room
  on messenger_message_mentions(company_id, room_id, created_at desc);

create index if not exists idx_messenger_messages_search_body
  on messenger_messages using gin (to_tsvector('simple', coalesce(body, '')));
