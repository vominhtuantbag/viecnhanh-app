-- Nâng cấp: badge tin nhắn chưa đọc + đề xuất chưa xem.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- KHÔNG xóa dữ liệu. Chạy trên DB đang dùng.
-- Realtime: Dashboard → Database → Publications → supabase_realtime
--   bật bảng public.messages, public.bids, public.conversations, public.jobs (nếu chưa có).

alter table public.conversations
  add column if not exists poster_last_read_at timestamptz default now();
alter table public.conversations
  add column if not exists worker_last_read_at timestamptz default now();
alter table public.conversations alter column poster_last_read_at drop default;
alter table public.conversations alter column worker_last_read_at drop default;

alter table public.bids
  add column if not exists seen_by_poster_at timestamptz default now();
alter table public.bids alter column seen_by_poster_at drop default;

create index if not exists messages_unread_idx
  on public.messages (conversation_id, sender_id, created_at);
create index if not exists bids_unseen_poster_idx
  on public.bids (job_id)
  where seen_by_poster_at is null;

alter table public.messages replica identity full;
alter table public.conversations replica identity full;
alter table public.bids replica identity full;
alter table public.jobs replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.bids;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jobs;
  exception when duplicate_object then null;
  end;
end $$;

drop policy if exists "conversations_update_read" on public.conversations;
create policy "conversations_update_read" on public.conversations for update
  using (auth.uid() = poster_id or auth.uid() = worker_id)
  with check (auth.uid() = poster_id or auth.uid() = worker_id);

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_conv public.conversations;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để đánh dấu đã đọc.';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv.id is null then
    raise exception 'Không tìm thấy cuộc trò chuyện.';
  end if;

  if v_user <> v_conv.poster_id and v_user <> v_conv.worker_id then
    raise exception 'Bạn không thuộc cuộc trò chuyện này.';
  end if;

  if v_user = v_conv.poster_id then
    update public.conversations
    set poster_last_read_at = now()
    where id = p_conversation_id;
  else
    update public.conversations
    set worker_last_read_at = now()
    where id = p_conversation_id;
  end if;

  return 0;
end;
$$;

create or replace function public.fetch_unread_message_counts()
returns table (conversation_id uuid, unread_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  return query
  select
    c.id,
    (
      select count(*)::integer
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id is distinct from v_user
        and m.created_at > coalesce(
          case
            when c.poster_id = v_user then c.poster_last_read_at
            else c.worker_last_read_at
          end,
          'epoch'::timestamptz
        )
    )
  from public.conversations c
  where c.poster_id = v_user or c.worker_id = v_user;
end;
$$;

create or replace function public.mark_job_bids_seen(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để đánh dấu đề xuất đã xem.';
  end if;

  select user_id into v_owner from public.jobs where id = p_job_id;
  if v_owner is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_owner <> v_user then
    raise exception 'Chỉ người đăng tin mới đánh dấu đề xuất đã xem.';
  end if;

  update public.bids
  set seen_by_poster_at = now()
  where job_id = p_job_id
    and seen_by_poster_at is null;

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.fetch_unread_bid_counts()
returns table (job_id uuid, unread_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  return query
  select b.job_id, count(*)::integer
  from public.bids b
  inner join public.jobs j on j.id = b.job_id
  where j.user_id = v_user
    and b.seen_by_poster_at is null
  group by b.job_id;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.fetch_unread_message_counts() to authenticated;
grant execute on function public.mark_job_bids_seen(uuid) to authenticated;
grant execute on function public.fetch_unread_bid_counts() to authenticated;
