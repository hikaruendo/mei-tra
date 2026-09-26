-- Only the backend service role can write or read moderation records.
create table public.chat_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint chat_user_blocks_no_self_block check (blocker_id <> blocked_id)
);
create index chat_user_blocks_blocked_id_idx on public.chat_user_blocks(blocked_id);

create table public.chat_message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_sender_id uuid references auth.users(id) on delete set null,
  message_id uuid not null,
  room_id uuid not null,
  content_snapshot text not null,
  reason text not null check (reason in ('offensive', 'harassment', 'other')),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'actioned')),
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);
create index chat_message_reports_pending_idx
  on public.chat_message_reports(created_at) where status = 'pending';

alter table public.chat_user_blocks enable row level security;
alter table public.chat_message_reports enable row level security;
create policy "Service role manages chat blocks" on public.chat_user_blocks
  for all to service_role using (true) with check (true);
create policy "Service role manages chat reports" on public.chat_message_reports
  for all to service_role using (true) with check (true);

revoke all on public.chat_user_blocks from anon, authenticated;
revoke all on public.chat_message_reports from anon, authenticated;
grant all on public.chat_user_blocks to service_role;
grant all on public.chat_message_reports to service_role;
