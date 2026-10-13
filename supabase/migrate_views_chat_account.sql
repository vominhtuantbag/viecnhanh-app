-- Nâng cấp database đang chạy: KHÔNG xóa jobs/bids/profiles.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Sau đó: Database → Replication (Realtime) → bật bảng public.messages.

alter table public.profiles add column if not exists rating_avg numeric not null default 0;
alter table public.profiles add column if not exists reviews_count integer not null default 0;
alter table public.profiles add column if not exists completed_jobs integer not null default 0;
alter table public.profiles add column if not exists notify_push boolean not null default true;
alter table public.profiles add column if not exists notify_new_jobs boolean not null default true;
alter table public.profiles add column if not exists notify_new_bids boolean not null default true;
alter table public.jobs add column if not exists views_count integer not null default 0;
alter table public.jobs add column if not exists hired_worker_id uuid references public.profiles (id) on delete set null;
alter table public.jobs add column if not exists hired_bid_id uuid;

create table if not exists public.job_views (
  job_id uuid not null references public.jobs (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, viewer_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  bid_id uuid not null references public.bids (id) on delete cascade,
  poster_id uuid not null references public.profiles (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, worker_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  kind text not null default 'text'
    check (kind in ('text', 'phone_share', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'bank'
    check (kind in ('bank', 'momo', 'zalopay', 'cash')),
  label text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.jobs drop constraint if exists jobs_hired_bid_fk;
alter table public.jobs
  add constraint jobs_hired_bid_fk
  foreign key (hired_bid_id) references public.bids (id) on delete set null;

create index if not exists job_views_viewer_idx on public.job_views (viewer_id);
create index if not exists conversations_poster_idx on public.conversations (poster_id);
create index if not exists conversations_worker_idx on public.conversations (worker_id);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists payment_methods_user_idx on public.payment_methods (user_id);

drop function if exists public.increment_job_views(uuid);
drop function if exists public.record_job_view(uuid);

create or replace function public.record_job_view(p_job_id uuid)
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
  select user_id, views_count into v_owner, v_count
  from public.jobs
  where id = p_job_id;

  if v_owner is null then
    return 0;
  end if;

  if v_user is null or v_user = v_owner then
    return coalesce(v_count, 0);
  end if;

  insert into public.job_views (job_id, viewer_id)
  values (p_job_id, v_user)
  on conflict (job_id, viewer_id) do nothing;

  update public.jobs
  set views_count = (select count(*) from public.job_views where job_id = p_job_id)
  where id = p_job_id
  returning views_count into v_count;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.increment_job_views(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.record_job_view(p_job_id);
end;
$$;

create or replace function public.get_or_create_conversation(p_job_id uuid, p_worker_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_bid public.bids;
  v_row public.conversations;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để mở cuộc trò chuyện.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  select * into v_bid
  from public.bids
  where job_id = p_job_id and worker_id = p_worker_id;

  if v_bid.id is null then
    raise exception 'Thợ này chưa gửi đề xuất cho tin đăng.';
  end if;

  if v_user <> v_job.user_id and v_user <> p_worker_id then
    raise exception 'Bạn không thuộc cuộc trò chuyện này.';
  end if;

  select * into v_row
  from public.conversations
  where job_id = p_job_id and worker_id = p_worker_id;

  if v_row.id is not null then
    return v_row;
  end if;

  if v_user <> v_job.user_id then
    raise exception 'Người đăng tin cần nhắn tin trước khi bắt đầu cuộc trò chuyện.';
  end if;

  insert into public.conversations (job_id, bid_id, poster_id, worker_id)
  values (p_job_id, v_bid.id, v_job.user_id, p_worker_id)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_kind text default 'text'
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_conv public.conversations;
  v_kind text := coalesce(nullif(p_kind, ''), 'text');
  v_row public.messages;
  v_poster_sent boolean;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để gửi tin nhắn.';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv.id is null then
    raise exception 'Không tìm thấy cuộc trò chuyện.';
  end if;

  if v_user <> v_conv.poster_id and v_user <> v_conv.worker_id then
    raise exception 'Bạn không thuộc cuộc trò chuyện này.';
  end if;

  if v_kind not in ('text', 'phone_share', 'system') then
    raise exception 'Loại tin nhắn không hợp lệ.';
  end if;

  if v_kind = 'system' then
    raise exception 'Không gửi được tin hệ thống từ ứng dụng.';
  end if;

  if v_kind = 'phone_share' and v_user <> v_conv.poster_id then
    raise exception 'Chỉ người đăng tin mới gửi số điện thoại.';
  end if;

  select exists (
    select 1 from public.messages
    where conversation_id = p_conversation_id
      and sender_id = v_conv.poster_id
      and kind <> 'system'
  ) into v_poster_sent;

  if v_user = v_conv.worker_id and not v_poster_sent then
    raise exception 'Người đăng tin phải gửi tin nhắn đầu tiên. Sau đó bạn mới có thể trả lời.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (p_conversation_id, v_user, trim(p_body), v_kind)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.submit_bid(
  p_job_id uuid,
  p_proposed_price numeric,
  p_message text default ''
)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_bid public.bids;
  v_fee numeric := 3000;
  v_balance numeric;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để gửi đề xuất.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.user_id = v_user then
    raise exception 'Bạn không thể báo giá tin của chính mình.';
  end if;

  if v_job.status <> 'approved' or coalesce(v_job.is_approved, false) = false then
    raise exception 'Tin đăng chưa nhận đề xuất.';
  end if;

  select * into v_bid
  from public.bids
  where job_id = p_job_id and worker_id = v_user;

  if v_bid.id is not null then
    raise exception 'BID_EXISTS';
  end if;

  select wallet_balance into v_balance
  from public.profiles
  where id = v_user
  for update;

  if coalesce(v_balance, 0) < v_fee then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles
  set wallet_balance = wallet_balance - v_fee
  where id = v_user;

  insert into public.bids (job_id, worker_id, proposed_price, message, status)
  values (
    p_job_id,
    v_user,
    coalesce(p_proposed_price, 0),
    coalesce(trim(p_message), ''),
    'pending'
  )
  returning * into v_bid;

  return v_bid;
end;
$$;

create or replace function public.hire_worker(p_bid_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_bid public.bids;
  v_job public.jobs;
  v_conv public.conversations;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để thuê thợ.';
  end if;

  select * into v_bid from public.bids where id = p_bid_id;
  if v_bid.id is null then
    raise exception 'Không tìm thấy đề xuất.';
  end if;

  select * into v_job from public.jobs where id = v_bid.job_id;
  if v_job.user_id <> v_user then
    raise exception 'Chỉ người đăng tin mới xác nhận thuê thợ.';
  end if;

  if v_job.hired_worker_id is not null then
    raise exception 'Tin đăng này đã thuê thợ.';
  end if;

  update public.bids
  set status = case when id = p_bid_id then 'accepted' else 'rejected' end
  where job_id = v_job.id;

  update public.jobs
  set hired_worker_id = v_bid.worker_id,
      hired_bid_id = v_bid.id
  where id = v_job.id
  returning * into v_job;

  select * into v_conv
  from public.conversations
  where job_id = v_job.id and worker_id = v_bid.worker_id;

  if v_conv.id is not null then
    insert into public.messages (conversation_id, sender_id, body, kind)
    values (
      v_conv.id,
      v_user,
      'Người đăng tin đã xác nhận thuê bạn thực hiện công việc này.',
      'system'
    );
  end if;

  return v_job;
end;
$$;

create or replace function public.enforce_chat_rules()
returns trigger
language plpgsql
as $$
declare
  v_conv public.conversations;
  v_poster_sent boolean;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv.id is null then
    raise exception 'Không tìm thấy cuộc trò chuyện.';
  end if;

  if new.kind = 'phone_share' and new.sender_id <> v_conv.poster_id then
    raise exception 'Chỉ người đăng tin mới gửi số điện thoại.';
  end if;

  if new.kind = 'system' then
    return new;
  end if;

  select exists (
    select 1 from public.messages
    where conversation_id = new.conversation_id
      and sender_id = v_conv.poster_id
      and kind <> 'system'
      and id is distinct from new.id
  ) into v_poster_sent;

  if new.sender_id = v_conv.worker_id and not v_poster_sent then
    raise exception 'Người đăng tin phải gửi tin nhắn đầu tiên. Sau đó bạn mới có thể trả lời.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_enforce_chat_rules on public.messages;
create trigger messages_enforce_chat_rules
  before insert on public.messages
  for each row execute function public.enforce_chat_rules();

alter table public.messages replica identity full;

alter table public.job_views enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.payment_methods enable row level security;

drop policy if exists "job_views_select" on public.job_views;
drop policy if exists "job_views_insert" on public.job_views;
drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;
drop policy if exists "payment_methods_own" on public.payment_methods;

create policy "job_views_select" on public.job_views for select
  using (auth.uid() = viewer_id or auth.uid() = (select user_id from public.jobs j where j.id = job_id));
create policy "job_views_insert" on public.job_views for insert
  with check (auth.uid() = viewer_id);

create policy "conversations_select" on public.conversations for select
  using (auth.uid() = poster_id or auth.uid() = worker_id);
create policy "conversations_insert" on public.conversations for insert
  with check (auth.uid() = poster_id);

create policy "messages_select" on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.poster_id = auth.uid() or c.worker_id = auth.uid())
    )
  );
create policy "messages_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.poster_id = auth.uid() or c.worker_id = auth.uid())
    )
  );

create policy "payment_methods_own" on public.payment_methods for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert on public.job_views to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant execute on function public.increment_job_views(uuid) to anon, authenticated;
grant execute on function public.record_job_view(uuid) to anon, authenticated;
grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text, text) to authenticated;
grant execute on function public.hire_worker(uuid) to authenticated;
grant execute on function public.submit_bid(uuid, numeric, text) to authenticated;
