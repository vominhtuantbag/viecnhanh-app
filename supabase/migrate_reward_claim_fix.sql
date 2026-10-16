-- Sửa điểm danh, nhận xu và đổi quà.
-- Dán vào Supabase SQL Editor → Run.
-- Không xoá tin đăng, ví hay nhiệm vụ cũ.

alter table public.profiles add column if not exists reward_points integer not null default 0;
alter table public.profiles add column if not exists reward_streak integer not null default 0;
alter table public.profiles add column if not exists last_checkin_date date;
alter table public.profiles add column if not exists lucky_spins integer not null default 0;
alter table public.profiles add column if not exists mystery_boxes integer not null default 0;
alter table public.profiles add column if not exists boost_credits integer not null default 0;
alter table public.profiles add column if not exists badges text[] not null default '{}';
alter table public.user_tasks add column if not exists pending_points integer not null default 0;

create table if not exists public.user_checkins (
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_on date not null,
  reward_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, checked_on)
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete restrict,
  points_spent integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'rejected')),
  claim_code text,
  created_at timestamptz not null default now()
);

alter table public.user_checkins enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "user_checkins_own" on public.user_checkins;
create policy "user_checkins_own" on public.user_checkins
  for select using (auth.uid() = user_id);

drop policy if exists "reward_redemptions_own" on public.reward_redemptions;
create policy "reward_redemptions_own" on public.reward_redemptions
  for select using (auth.uid() = user_id or public.is_current_admin());

grant select on public.user_checkins to authenticated;
grant select on public.reward_redemptions to authenticated;

create or replace function public.reward_daily_checkin()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (timezone('Asia/Ho_Chi_Minh', now()))::date;
  v_task public.tasks;
  v_last date;
  v_streak integer;
  v_day integer;
  v_points integer;
  v_spin boolean := false;
  v_box boolean := false;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để điểm danh.';
  end if;

  if not exists (
    select 1 from public.tasks
    where is_active = true and action_type = 'daily_checkin'
  ) then
    raise exception 'Chưa có nhiệm vụ điểm danh.';
  end if;

  select reward_streak, last_checkin_date into v_streak, v_last
  from public.profiles where id = v_user for update;

  if v_last = v_today then
    raise exception 'Hôm nay bạn đã điểm danh rồi.';
  end if;

  if v_last = v_today - 1 then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  v_day := ((v_streak - 1) % 7) + 1;
  v_points := case v_day
    when 1 then 100
    when 2 then 150
    when 3 then 200
    when 4 then 300
    when 5 then 400
    when 6 then 600
    else 1000
  end;

  if v_day = 7 then
    v_spin := true;
  end if;
  if v_day in (3, 7) then
    v_box := true;
  end if;

  update public.profiles
  set reward_streak = v_streak,
      last_checkin_date = v_today,
      reward_points = coalesce(reward_points, 0) + v_points,
      lucky_spins = coalesce(lucky_spins, 0) + case when v_spin then 1 else 0 end,
      mystery_boxes = coalesce(mystery_boxes, 0) + case when v_box then 1 else 0 end
  where id = v_user;

  begin
    insert into public.user_checkins (user_id, checked_on, reward_amount)
    values (v_user, v_today, v_points)
    on conflict (user_id, checked_on) do nothing;
  exception when others then
    raise notice 'user_checkins: %', sqlerrm;
  end;

  for v_task in
    select * from public.tasks
    where is_active = true and action_type = 'daily_checkin'
  loop
    insert into public.user_tasks (user_id, task_id, current_count, status, pending_points, completed_at)
    values (v_user, v_task.id, v_day, 'claimed', 0, now())
    on conflict (user_id, task_id) do update
      set current_count = v_day,
          status = 'claimed',
          pending_points = 0,
          completed_at = now(),
          updated_at = now();
  end loop;

  return v_points;
end;
$$;

create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.rewards;
  v_points integer;
  v_claim public.reward_claims;
  v_status text;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để đổi quà.';
  end if;

  select * into v_reward from public.rewards where id = p_reward_id and is_active = true for update;
  if v_reward.id is null then
    raise exception 'Phần thưởng không còn.';
  end if;
  if coalesce(v_reward.stock_quantity, 0) <= 0 then
    raise exception 'Phần thưởng đã hết.';
  end if;

  select coalesce(reward_points, 0) into v_points from public.profiles where id = v_user for update;
  if v_points < v_reward.point_cost then
    raise exception 'Bạn chưa đủ xu để đổi quà này.';
  end if;

  v_status := case
    when v_reward.type in ('app_balance', 'badge', 'boost', 'lucky_spin', 'mystery_box') then 'completed'
    else 'pending'
  end;

  update public.profiles
  set reward_points = v_points - v_reward.point_cost,
      wallet_balance = coalesce(wallet_balance, 0) + case when v_reward.type = 'app_balance' then v_reward.value else 0 end
  where id = v_user;

  begin
    if v_reward.type = 'lucky_spin' then
      update public.profiles set lucky_spins = coalesce(lucky_spins, 0) + 1 where id = v_user;
    elsif v_reward.type = 'mystery_box' then
      update public.profiles set mystery_boxes = coalesce(mystery_boxes, 0) + 1 where id = v_user;
    elsif v_reward.type = 'boost' then
      update public.profiles set boost_credits = coalesce(boost_credits, 0) + 1 where id = v_user;
    end if;
  exception when undefined_column then
    null;
  end;

  update public.rewards
  set stock_quantity = stock_quantity - 1
  where id = v_reward.id
    and stock_quantity > 0;
  if not found then
    raise exception 'Phần thưởng đã hết.';
  end if;

  insert into public.reward_claims (user_id, reward_id, status, claim_code)
  values (v_user, v_reward.id, v_status, null)
  returning * into v_claim;

  insert into public.reward_redemptions (user_id, reward_id, points_spent, status, claim_code)
  values (v_user, v_reward.id, v_reward.point_cost, v_status, v_claim.claim_code);

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'status', v_claim.status,
    'claim_code', v_claim.claim_code,
    'points_left', v_points - v_reward.point_cost
  );
end;
$$;

grant execute on function public.reward_daily_checkin() to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
