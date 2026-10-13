-- Nhiệm vụ thợ + mã giới thiệu + voucher + quyền admin.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Không xóa dữ liệu hiện có.
--
-- Gán admin (thay UUID):
--   update public.profiles set is_admin = true where id = 'USER_UUID';

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles (id) on delete set null;

create unique index if not exists profiles_referral_code_unique
  on public.profiles (referral_code)
  where referral_code is not null;

create or replace function public.next_referral_code()
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := 'VN' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1 from public.profiles where referral_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

create or replace function public.ensure_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    new.referral_code := public.next_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_referral_code on public.profiles;
create trigger profiles_referral_code
  before insert or update on public.profiles
  for each row execute function public.ensure_referral_code();

update public.profiles
set referral_code = public.next_referral_code()
where referral_code is null or btrim(referral_code) = '';

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  reward_amount numeric not null default 0,
  requirement_count integer not null default 1,
  kind text not null default 'once'
    check (kind in ('once', 'daily')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_quests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  quest_id uuid not null references public.quests (id) on delete cascade,
  progress integer not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  primary key (user_id, quest_id)
);

create table if not exists public.user_checkins (
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_on date not null,
  reward_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, checked_on)
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  discount_type text not null default 'wallet'
    check (discount_type in ('wallet', 'percent', 'fixed')),
  amount numeric not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  source text not null default 'redeem',
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, voucher_id)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  reward_amount numeric not null default 5000,
  status text not null default 'rewarded'
    check (status in ('pending', 'rewarded')),
  created_at timestamptz not null default now(),
  unique (invitee_id)
);

alter table public.quests enable row level security;
alter table public.user_quests enable row level security;
alter table public.user_checkins enable row level security;
alter table public.vouchers enable row level security;
alter table public.user_vouchers enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "quests_select" on public.quests;
drop policy if exists "user_quests_own" on public.user_quests;
drop policy if exists "user_checkins_own" on public.user_checkins;
drop policy if exists "vouchers_select" on public.vouchers;
drop policy if exists "user_vouchers_own" on public.user_vouchers;
drop policy if exists "referrals_own" on public.referrals;

create policy "quests_select" on public.quests for select using (true);
create policy "user_quests_own" on public.user_quests for select using (auth.uid() = user_id);
create policy "user_checkins_own" on public.user_checkins for select using (auth.uid() = user_id);
create policy "vouchers_select" on public.vouchers for select using (is_active = true);
create policy "user_vouchers_own" on public.user_vouchers for select using (auth.uid() = user_id);
create policy "referrals_own" on public.referrals for select
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

grant select on public.quests to anon, authenticated;
grant select on public.user_quests to authenticated;
grant select on public.user_checkins to authenticated;
grant select on public.vouchers to anon, authenticated;
grant select on public.user_vouchers to authenticated;
grant select on public.referrals to authenticated;

insert into public.quests (slug, title, description, reward_amount, requirement_count, kind, sort_order)
values
  ('daily_checkin', 'Điểm danh hằng ngày', 'Mở app và điểm danh mỗi ngày để nhận xu vào ví.', 1000, 1, 'daily', 10),
  ('complete_profile', 'Hoàn tất hồ sơ', 'Thêm họ tên và số điện thoại để mọi người tin tưởng hơn.', 2000, 1, 'once', 20),
  ('first_bid', 'Gửi đề xuất đầu tiên', 'Báo giá cho một công việc trên Khám phá.', 3000, 1, 'once', 30),
  ('first_job_done', 'Hoàn thành đơn đầu tiên', 'Được thuê và hoàn thành xong một việc.', 10000, 1, 'once', 40),
  ('invite_friend', 'Mời 1 người bạn', 'Bạn bè nhập mã giới thiệu của bạn khi đăng ký.', 5000, 1, 'once', 50),
  ('five_jobs', 'Hoàn thành 5 việc', 'Tích lũy 5 công việc đã hoàn thành với vai trò thợ.', 20000, 5, 'once', 60)
on conflict (slug) do update
set title = excluded.title,
    description = excluded.description,
    reward_amount = excluded.reward_amount,
    requirement_count = excluded.requirement_count,
    kind = excluded.kind,
    sort_order = excluded.sort_order,
    is_active = true;

insert into public.vouchers (code, title, description, discount_type, amount, max_uses)
values
  ('WELCOME10', 'Chào mừng thành viên mới', 'Cộng 10.000 đ vào ví khi nhập mã.', 'wallet', 10000, 10000),
  ('BANBEE5', 'Thưởng mời bạn', 'Cộng 5.000 đ khi mã giới thiệu được dùng.', 'wallet', 5000, null)
on conflict (code) do nothing;

create or replace function public.bump_quest_progress(p_user uuid, p_slug text, p_delta integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quest public.quests;
  v_progress integer;
begin
  if p_user is null then
    return;
  end if;
  select * into v_quest from public.quests where slug = p_slug and is_active = true;
  if v_quest.id is null or v_quest.kind = 'daily' then
    return;
  end if;

  insert into public.user_quests (user_id, quest_id, progress)
  values (p_user, v_quest.id, greatest(p_delta, 0))
  on conflict (user_id, quest_id) do update
    set progress = public.user_quests.progress + greatest(p_delta, 0);

  select progress into v_progress
  from public.user_quests
  where user_id = p_user and quest_id = v_quest.id;

  if v_progress >= v_quest.requirement_count then
    update public.user_quests
    set completed_at = coalesce(completed_at, now())
    where user_id = p_user and quest_id = v_quest.id and completed_at is null;
  end if;
end;
$$;

create or replace function public.claim_quest_reward(p_slug text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_quest public.quests;
  v_row public.user_quests;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để nhận thưởng.';
  end if;

  select * into v_quest from public.quests where slug = p_slug and is_active = true;
  if v_quest.id is null or v_quest.kind <> 'once' then
    raise exception 'Không tìm thấy nhiệm vụ.';
  end if;

  select * into v_row from public.user_quests where user_id = v_user and quest_id = v_quest.id;
  if v_row.quest_id is null or v_row.progress < v_quest.requirement_count then
    raise exception 'Bạn chưa hoàn thành nhiệm vụ này.';
  end if;
  if v_row.claimed_at is not null then
    raise exception 'Bạn đã nhận thưởng nhiệm vụ này rồi.';
  end if;

  update public.user_quests
  set claimed_at = now(), completed_at = coalesce(completed_at, now())
  where user_id = v_user and quest_id = v_quest.id;

  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + v_quest.reward_amount
  where id = v_user;

  return v_quest.reward_amount;
end;
$$;

create or replace function public.daily_checkin()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (timezone('Asia/Ho_Chi_Minh', now()))::date;
  v_reward numeric := 1000;
  v_quest uuid;
  v_inserted integer := 0;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để điểm danh.';
  end if;

  select q.reward_amount, q.id into v_reward, v_quest
  from public.quests q
  where q.slug = 'daily_checkin' and q.is_active = true;

  v_reward := coalesce(v_reward, 1000);

  insert into public.user_checkins (user_id, checked_on, reward_amount)
  values (v_user, v_today, v_reward)
  on conflict (user_id, checked_on) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'Hôm nay bạn đã điểm danh rồi.';
  end if;

  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + v_reward
  where id = v_user;

  if v_quest is not null then
    insert into public.user_quests (user_id, quest_id, progress, completed_at, claimed_at)
    values (v_user, v_quest, 1, now(), now())
    on conflict (user_id, quest_id) do update
      set progress = public.user_quests.progress + 1,
          completed_at = now(),
          claimed_at = now();
  end if;

  return v_reward;
end;
$$;

create or replace function public.apply_referral_code(p_code text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_inviter public.profiles;
  v_reward numeric := 5000;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để nhập mã giới thiệu.';
  end if;
  if v_code = '' then
    raise exception 'Vui lòng nhập mã giới thiệu.';
  end if;

  if exists (select 1 from public.referrals where invitee_id = v_user) then
    raise exception 'Tài khoản này đã dùng mã giới thiệu rồi.';
  end if;

  select * into v_inviter
  from public.profiles
  where upper(referral_code) = v_code;

  if v_inviter.id is null then
    raise exception 'Mã giới thiệu không đúng.';
  end if;
  if v_inviter.id = v_user then
    raise exception 'Bạn không thể dùng mã của chính mình.';
  end if;

  update public.profiles
  set referred_by = v_inviter.id
  where id = v_user and referred_by is null;

  insert into public.referrals (inviter_id, invitee_id, code, reward_amount, status)
  values (v_inviter.id, v_user, v_code, v_reward, 'rewarded');

  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + v_reward
  where id in (v_user, v_inviter.id);

  perform public.bump_quest_progress(v_inviter.id, 'invite_friend', 1);

  return v_reward;
end;
$$;

create or replace function public.redeem_voucher_code(p_code text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_voucher public.vouchers;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để dùng mã.';
  end if;
  if v_code = '' then
    raise exception 'Vui lòng nhập mã giảm giá.';
  end if;

  select * into v_voucher
  from public.vouchers
  where upper(code) = v_code;

  if v_voucher.id is null or v_voucher.is_active = false then
    raise exception 'Mã giảm giá không tồn tại hoặc đã tắt.';
  end if;
  if v_voucher.valid_until is not null and v_voucher.valid_until < now() then
    raise exception 'Mã giảm giá đã hết hạn.';
  end if;
  if v_voucher.max_uses is not null and v_voucher.used_count >= v_voucher.max_uses then
    raise exception 'Mã giảm giá đã hết lượt dùng.';
  end if;
  if exists (
    select 1 from public.user_vouchers
    where user_id = v_user and voucher_id = v_voucher.id
  ) then
    raise exception 'Bạn đã dùng mã này rồi.';
  end if;

  insert into public.user_vouchers (user_id, voucher_id, source, redeemed_at)
  values (v_user, v_voucher.id, 'redeem', now());

  update public.vouchers
  set used_count = used_count + 1
  where id = v_voucher.id;

  if v_voucher.discount_type = 'wallet' or v_voucher.discount_type = 'fixed' then
    update public.profiles
    set wallet_balance = coalesce(wallet_balance, 0) + v_voucher.amount
    where id = v_user;
  end if;

  return v_voucher.amount;
end;
$$;

create or replace function public.on_bid_quest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_quest_progress(new.worker_id, 'first_bid', 1);
  return new;
end;
$$;

drop trigger if exists bids_quest_progress on public.bids;
create trigger bids_quest_progress
  after insert on public.bids
  for each row execute function public.on_bid_quest();

create or replace function public.on_job_quest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'completed')
     and new.hired_worker_id is not null then
    perform public.bump_quest_progress(new.hired_worker_id, 'first_job_done', 1);
    perform public.bump_quest_progress(new.hired_worker_id, 'five_jobs', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_quest_progress on public.jobs;
create trigger jobs_quest_progress
  after insert or update of status, hired_worker_id on public.jobs
  for each row execute function public.on_job_quest();

create or replace function public.on_profile_quest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(btrim(new.full_name), '') <> '' and coalesce(btrim(new.phone), '') <> '' then
    perform public.bump_quest_progress(new.id, 'complete_profile', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_quest_progress on public.profiles;
create trigger profiles_quest_progress
  after insert or update of full_name, phone on public.profiles
  for each row execute function public.on_profile_quest();

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.admin_set_job_status(p_job_id uuid, p_status text, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_admin() then
    raise exception 'Chỉ quản trị viên mới được duyệt tin.';
  end if;
  if p_status not in ('pending', 'approved', 'assigned', 'completed', 'closed') then
    raise exception 'Trạng thái không hợp lệ.';
  end if;
  update public.jobs
  set status = p_status,
      is_approved = coalesce(p_approved, p_status = 'approved')
  where id = p_job_id;
end;
$$;

create or replace function public.admin_upsert_voucher(
  p_code text,
  p_title text,
  p_amount numeric,
  p_max_uses integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_current_admin() then
    raise exception 'Chỉ quản trị viên mới tạo mã.';
  end if;
  insert into public.vouchers (code, title, description, discount_type, amount, max_uses)
  values (upper(btrim(p_code)), p_title, '', 'wallet', greatest(p_amount, 0), p_max_uses)
  on conflict (code) do update
    set title = excluded.title,
        amount = excluded.amount,
        max_uses = excluded.max_uses,
        is_active = true
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.claim_quest_reward(text) to authenticated;
grant execute on function public.daily_checkin() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.redeem_voucher_code(text) to authenticated;
grant execute on function public.is_current_admin() to authenticated;
grant execute on function public.admin_set_job_status(uuid, text, boolean) to authenticated;
grant execute on function public.admin_upsert_voucher(text, text, numeric, integer) to authenticated;
revoke all on function public.bump_quest_progress(uuid, text, integer) from public, anon, authenticated;
