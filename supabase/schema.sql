-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Phần 3 (Auth): profiles.id = auth.users.id để đổi tài khoản / đấu giá.
--
-- Cấu hình Auth (Dashboard → Authentication):
-- 1. Providers → Email: BẬT Email. TẮT "Confirm email" để đăng ký SĐT+mật khẩu vào được ngay.
--    (SĐT được ánh xạ thành email nội bộ 84xxxxxxxxx@phone.viecnhanh.local — không gửi mail.)
-- 2. Providers → Google / Apple: bật và dán Client ID / Secret.
-- 3. URL Configuration → Redirect URLs thêm:
--      appmuabanviec://**
--      exp://**
--      http://localhost:8081/**
--
-- Script này XÓA jobs/bids/profiles cũ (demo). Dữ liệu tin đăng local trên máy không bị ảnh hưởng.
-- Nếu database đang có dữ liệu thật: KHÔNG chạy cả file này.
-- Hãy chạy supabase/migrate_views_chat_account.sql, supabase/migrate_unread_badges.sql,
-- rồi supabase/migrate_job_lifecycle.sql, cuối cùng supabase/migrate_push_notifications.sql.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.job_views cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.offers cascade;
drop table if exists public.tasks cascade;
drop table if exists public.reviews cascade;
drop table if exists public.bids cascade;
drop table if exists public.jobs cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  full_name text,
  avatar_url text,
  wallet_balance numeric not null default 50000,
  rating_avg numeric not null default 0,
  reviews_count integer not null default 0,
  completed_jobs integer not null default 0,
  notify_push boolean not null default true,
  notify_new_jobs boolean not null default true,
  notify_new_bids boolean not null default true,
  notify_wallet boolean not null default true,
  notify_messages boolean not null default true,
  notify_hired boolean not null default true,
  notify_hire_cancelled boolean not null default true,
  notify_reviews boolean not null default true,
  notify_promo boolean not null default true,
  id_verified boolean not null default false,
  province_id text,
  ward_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_phone_unique
  on public.profiles (phone)
  where phone is not null and length(trim(phone)) > 0;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  price numeric not null default 0,
  province_id text,
  ward_id text,
  category_id text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'assigned', 'completed', 'closed')),
  views_count integer not null default 0,
  hired_worker_id uuid references public.profiles (id) on delete set null,
  hired_bid_id uuid,
  is_approved boolean not null default false,
  hire_cancel_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  proposed_price numeric not null default 0,
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  seen_by_poster_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  unique (job_id, worker_id)
);

create table public.job_views (
  job_id uuid not null references public.jobs (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, viewer_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  bid_id uuid not null references public.bids (id) on delete cascade,
  poster_id uuid not null references public.profiles (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  poster_last_read_at timestamptz,
  worker_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, worker_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  kind text not null default 'text'
    check (kind in ('text', 'phone_share', 'system')),
  created_at timestamptz not null default now()
);

create table public.payment_methods (
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

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating numeric not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  role text not null default 'worker'
    check (role in ('worker', 'poster')),
  created_at timestamptz not null default now()
);

alter table public.jobs drop constraint if exists jobs_hired_bid_fk;
alter table public.jobs
  add constraint jobs_hired_bid_fk
  foreign key (hired_bid_id) references public.bids (id) on delete set null;

create index jobs_status_idx on public.jobs (status, is_approved);
create index jobs_user_idx on public.jobs (user_id);
create index bids_job_idx on public.bids (job_id);
create index bids_worker_idx on public.bids (worker_id);
create index reviews_worker_idx on public.reviews (worker_id);
create index job_views_viewer_idx on public.job_views (viewer_id);
create index conversations_poster_idx on public.conversations (poster_id);
create index conversations_worker_idx on public.conversations (worker_id);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_unread_idx on public.messages (conversation_id, sender_id, created_at);
create index bids_unseen_poster_idx on public.bids (job_id) where seen_by_poster_at is null;
create index payment_methods_user_idx on public.payment_methods (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, avatar_url, wallet_balance)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data->>'phone', new.phone, ''), ''),
    nullif(coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ), ''),
    nullif(coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      ''
    ), ''),
    50000
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chỉ tự duyệt khi user chưa có tin hiện hành (Đang mở). Đã nhận / Hoàn thành không chặn.
create or replace function public.apply_job_moderation()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count
  from public.jobs
  where user_id = new.user_id
    and status = 'approved';

  if existing_count = 0 then
    new.is_approved := true;
    new.status := 'approved';
  else
    new.is_approved := false;
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_moderation on public.jobs;
create trigger jobs_moderation
  before insert on public.jobs
  for each row execute function public.apply_job_moderation();

create or replace function public.refresh_worker_stats(p_worker_id uuid)
returns void
language plpgsql
as $$
begin
  update public.profiles
  set
    reviews_count = (select count(*) from public.reviews r where r.worker_id = p_worker_id),
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.worker_id = p_worker_id), 0),
    completed_jobs = (
      select count(*) from public.jobs j
      where j.hired_worker_id = p_worker_id and j.status = 'completed'
    )
  where id = p_worker_id;
end;
$$;

create or replace function public.refresh_worker_stats_from_review()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_worker_stats(coalesce(new.worker_id, old.worker_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_worker_stats_from_bid()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_worker_stats(coalesce(new.worker_id, old.worker_id));
  if tg_op = 'update' and old.worker_id is distinct from new.worker_id then
    perform public.refresh_worker_stats(old.worker_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_refresh_worker_stats on public.reviews;
create trigger reviews_refresh_worker_stats
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_worker_stats_from_review();

drop trigger if exists bids_refresh_worker_stats on public.bids;
create trigger bids_refresh_worker_stats
  after insert or update or delete on public.bids
  for each row execute function public.refresh_worker_stats_from_bid();

create or replace function public.refresh_worker_stats_from_job()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_worker_stats(coalesce(new.hired_worker_id, old.hired_worker_id));
  if tg_op = 'update' and old.hired_worker_id is distinct from new.hired_worker_id then
    perform public.refresh_worker_stats(old.hired_worker_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists jobs_refresh_worker_stats on public.jobs;
create trigger jobs_refresh_worker_stats
  after insert or update or delete on public.jobs
  for each row execute function public.refresh_worker_stats_from_job();

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

create or replace function public.fetch_chat_messages(p_conversation_id uuid)
returns setof public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ok boolean;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để xem tin nhắn.';
  end if;

  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.poster_id = v_user or c.worker_id = v_user)
  ) into v_ok;

  if not v_ok then
    raise exception 'Bạn không thuộc cuộc trò chuyện này.';
  end if;

  return query
    select *
    from public.messages
    where conversation_id = p_conversation_id
    order by created_at asc;
end;
$$;

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

  if v_job.status <> 'approved'
     or coalesce(v_job.is_approved, false) = false
     or v_job.hired_worker_id is not null then
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

  if v_job.status = 'completed' then
    raise exception 'Công việc đã hoàn thành.';
  end if;

  if v_job.hired_worker_id is not null or v_job.status = 'assigned' then
    raise exception 'Tin đăng này đã thuê thợ.';
  end if;

  if v_job.status <> 'approved' then
    raise exception 'Tin đăng chưa thể thuê thợ.';
  end if;

  update public.bids
  set status = case when id = p_bid_id then 'accepted' else 'rejected' end,
      cancel_reason = null
  where job_id = v_job.id
    and status <> 'cancelled';

  update public.bids
  set status = 'accepted',
      cancel_reason = null
  where id = p_bid_id;

  update public.jobs
  set hired_worker_id = v_bid.worker_id,
      hired_bid_id = v_bid.id,
      status = 'assigned',
      hire_cancel_reason = null,
      completed_at = null
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

create or replace function public.cancel_hire(p_job_id uuid, p_reason text)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_bid public.bids;
  v_conv public.conversations;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để hủy thuê thợ.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.user_id <> v_user then
    raise exception 'Chỉ người đăng tin mới hủy thuê thợ.';
  end if;

  if v_job.status = 'completed' then
    raise exception 'Công việc đã hoàn thành, không thể hủy thuê.';
  end if;

  if v_job.hired_worker_id is null and v_job.status <> 'assigned' then
    raise exception 'Tin đăng chưa thuê thợ.';
  end if;

  if v_reason is null then
    raise exception 'Vui lòng chọn lý do hủy thuê.';
  end if;

  if v_job.hired_bid_id is not null then
    select * into v_bid from public.bids where id = v_job.hired_bid_id;
  end if;

  if v_bid.id is null and v_job.hired_worker_id is not null then
    select * into v_bid
    from public.bids
    where job_id = v_job.id
      and worker_id = v_job.hired_worker_id
    order by created_at desc
    limit 1;
  end if;

  if v_bid.id is not null then
    update public.bids
    set status = 'cancelled',
        cancel_reason = v_reason
    where id = v_bid.id;
  end if;

  update public.bids
  set status = 'pending'
  where job_id = v_job.id
    and status = 'rejected';

  update public.jobs
  set hired_worker_id = null,
      hired_bid_id = null,
      status = 'approved',
      hire_cancel_reason = v_reason,
      completed_at = null
  where id = v_job.id
  returning * into v_job;

  if v_bid.worker_id is not null then
    select * into v_conv
    from public.conversations
    where job_id = v_job.id and worker_id = v_bid.worker_id;

    if v_conv.id is not null then
      insert into public.messages (conversation_id, sender_id, body, kind)
      values (
        v_conv.id,
        v_user,
        'Người đăng tin đã hủy thuê. Lý do: ' || v_reason,
        'system'
      );
    end if;
  end if;

  return v_job;
end;
$$;

create or replace function public.complete_job(
  p_job_id uuid,
  p_rating numeric default null,
  p_comment text default ''
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_conv public.conversations;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để hoàn tất công việc.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.user_id <> v_user then
    raise exception 'Chỉ người đăng tin mới thanh toán và hoàn tất.';
  end if;

  if v_job.status = 'completed' then
    return v_job;
  end if;

  if v_job.hired_worker_id is null then
    raise exception 'Chưa thuê thợ nên không thể hoàn tất.';
  end if;

  update public.jobs
  set status = 'completed',
      completed_at = coalesce(completed_at, now())
  where id = v_job.id
  returning * into v_job;

  select * into v_conv
  from public.conversations
  where job_id = v_job.id and worker_id = v_job.hired_worker_id;

  if v_conv.id is not null then
    insert into public.messages (conversation_id, sender_id, body, kind)
    values (
      v_conv.id,
      v_user,
      'Người đăng tin đã thanh toán và hoàn tất công việc.',
      'system'
    );
  end if;

  return v_job;
end;
$$;

create or replace function public.fetch_my_conversations()
returns setof public.conversations
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
    select *
    from public.conversations c
    where c.poster_id = v_user or c.worker_id = v_user
    order by c.created_at desc;
end;
$$;

create or replace function public.submit_job_review(
  p_job_id uuid,
  p_rating numeric,
  p_comment text default ''
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_subject uuid;
  v_role text;
  v_row public.reviews;
  v_exists boolean;
  v_has_role boolean;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để đánh giá.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Điểm đánh giá phải từ 1 đến 5.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.status <> 'completed' then
    raise exception 'Chỉ đánh giá sau khi công việc đã thanh toán.';
  end if;

  if v_user = v_job.user_id then
    v_subject := v_job.hired_worker_id;
    v_role := 'worker';
  elsif v_user = v_job.hired_worker_id then
    v_subject := v_job.user_id;
    v_role := 'poster';
  else
    raise exception 'Bạn không thuộc công việc này.';
  end if;

  if v_subject is null then
    raise exception 'Không xác định được người được đánh giá.';
  end if;

  select exists (
    select 1 from public.reviews r
    where r.job_id = v_job.id and r.reviewer_id = v_user
  ) into v_exists;

  if v_exists then
    select * into v_row
    from public.reviews
    where job_id = v_job.id and reviewer_id = v_user
    limit 1;
    return v_row;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviews' and column_name = 'role'
  ) into v_has_role;

  if v_has_role then
    insert into public.reviews (job_id, worker_id, reviewer_id, rating, comment, role)
    values (v_job.id, v_subject, v_user, p_rating, coalesce(trim(p_comment), ''), v_role)
    returning * into v_row;
  else
    insert into public.reviews (job_id, worker_id, reviewer_id, rating, comment)
    values (v_job.id, v_subject, v_user, p_rating, coalesce(trim(p_comment), ''))
    returning * into v_row;
  end if;

  return v_row;
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
alter table public.conversations replica identity full;
alter table public.bids replica identity full;
alter table public.jobs replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.jobs;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.bids;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.bids enable row level security;
alter table public.reviews enable row level security;
alter table public.job_views enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.payment_methods enable row level security;

drop policy if exists "profiles_all" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "jobs_all" on public.jobs;
drop policy if exists "bids_all" on public.bids;
drop policy if exists "reviews_select" on public.reviews;
drop policy if exists "reviews_insert" on public.reviews;
drop policy if exists "job_views_select" on public.job_views;
drop policy if exists "job_views_insert" on public.job_views;
drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "conversations_update_read" on public.conversations;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;
drop policy if exists "payment_methods_own" on public.payment_methods;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "jobs_all" on public.jobs for all using (true) with check (true);
create policy "bids_all" on public.bids for all using (true) with check (true);
create policy "reviews_select" on public.reviews for select using (true);
create policy "reviews_insert" on public.reviews for insert with check (auth.uid() = reviewer_id);

create policy "job_views_select" on public.job_views for select
  using (auth.uid() = viewer_id or auth.uid() = (select user_id from public.jobs j where j.id = job_id));
create policy "job_views_insert" on public.job_views for insert
  with check (auth.uid() = viewer_id);

create policy "conversations_select" on public.conversations for select
  using (auth.uid() = poster_id or auth.uid() = worker_id);
create policy "conversations_insert" on public.conversations for insert
  with check (auth.uid() = poster_id);
create policy "conversations_update_read" on public.conversations for update
  using (auth.uid() = poster_id or auth.uid() = worker_id)
  with check (auth.uid() = poster_id or auth.uid() = worker_id);

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

grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.jobs to anon, authenticated;
grant select, insert, update, delete on public.bids to anon, authenticated;
grant select, insert on public.reviews to anon, authenticated;
grant select, insert on public.job_views to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant execute on function public.increment_job_views(uuid) to anon, authenticated;
grant execute on function public.record_job_view(uuid) to anon, authenticated;
grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text, text) to authenticated;
grant execute on function public.submit_bid(uuid, numeric, text) to authenticated;
grant execute on function public.hire_worker(uuid) to authenticated;
grant execute on function public.cancel_hire(uuid, text) to authenticated;
grant execute on function public.complete_job(uuid, numeric, text) to authenticated;
grant execute on function public.submit_job_review(uuid, numeric, text) to authenticated;
grant execute on function public.fetch_my_conversations() to authenticated;
grant execute on function public.refresh_worker_stats(uuid) to anon, authenticated;
grant execute on function public.fetch_chat_messages(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.fetch_unread_message_counts() to authenticated;
grant execute on function public.mark_job_bids_seen(uuid) to authenticated;
grant execute on function public.fetch_unread_bid_counts() to authenticated;

-- Nâng cấp DB đang chạy (không xóa dữ liệu). Có thể chạy riêng phần này.
alter table public.profiles add column if not exists rating_avg numeric not null default 0;
alter table public.profiles add column if not exists reviews_count integer not null default 0;
alter table public.profiles add column if not exists completed_jobs integer not null default 0;
alter table public.profiles add column if not exists notify_push boolean not null default true;
alter table public.profiles add column if not exists notify_new_jobs boolean not null default true;
alter table public.profiles add column if not exists notify_new_bids boolean not null default true;
alter table public.profiles add column if not exists notify_wallet boolean not null default true;
alter table public.profiles add column if not exists notify_messages boolean not null default true;
alter table public.profiles add column if not exists notify_hired boolean not null default true;
alter table public.profiles add column if not exists notify_hire_cancelled boolean not null default true;
alter table public.profiles add column if not exists notify_reviews boolean not null default true;
alter table public.profiles add column if not exists notify_promo boolean not null default true;
alter table public.profiles add column if not exists id_verified boolean not null default false;
alter table public.reviews add column if not exists role text not null default 'worker';
alter table public.jobs add column if not exists hired_worker_id uuid references public.profiles (id) on delete set null;
alter table public.jobs add column if not exists hired_bid_id uuid;
alter table public.jobs add column if not exists hire_cancel_reason text;
alter table public.jobs add column if not exists completed_at timestamptz;
alter table public.bids add column if not exists cancel_reason text;
create unique index if not exists reviews_job_reviewer_unique
  on public.reviews (job_id, reviewer_id)
  where job_id is not null;

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
  poster_last_read_at timestamptz,
  worker_last_read_at timestamptz,
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

-- Badge unread: DB đang chạy hãy chạy thêm supabase/migrate_unread_badges.sql.
alter table public.conversations add column if not exists poster_last_read_at timestamptz;
alter table public.conversations add column if not exists worker_last_read_at timestamptz;
alter table public.bids add column if not exists seen_by_poster_at timestamptz;
alter table public.jobs add column if not exists category_id text;

-- Thông báo đẩy + bộ lọc việc làm: chạy thêm supabase/migrate_push_notifications.sql.
-- Sửa push + bật Realtime bảng jobs: chạy thêm supabase/migrate_push_realtime_fix.sql.
-- Nhiệm vụ / mã mời / voucher / admin: chạy thêm supabase/migrate_growth.sql.
