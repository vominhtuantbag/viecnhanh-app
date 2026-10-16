-- Sửa đổi quà: trừ xu, giảm hàng, ghi lịch sử.
-- Dán vào Supabase SQL Editor → Run.
-- Kèm sửa hàm hồ sơ để điểm danh và đổi quà không còn lỗi id_verified.

alter table public.profiles add column if not exists id_verified boolean not null default false;
alter table public.profiles add column if not exists reward_points integer not null default 0;

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

alter table public.reward_redemptions enable row level security;
drop policy if exists "reward_redemptions_own" on public.reward_redemptions;
create policy "reward_redemptions_own" on public.reward_redemptions
  for select using (auth.uid() = user_id or public.is_current_admin());
grant select on public.reward_redemptions to authenticated;

create or replace function public.on_profile_reward_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skills integer := 0;
  v_verified boolean := false;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'skill_ids'
  ) then
    execute 'select coalesce(array_length(skill_ids, 1), 0) from public.profiles where id = $1'
      into v_skills using new.id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id_verified'
  ) then
    execute 'select coalesce(id_verified, false) from public.profiles where id = $1'
      into v_verified using new.id;
  end if;

  if coalesce(new.full_name, '') <> ''
     and coalesce(new.phone, '') <> ''
     and (v_verified or v_skills > 0) then
    perform public.bump_reward_progress(new.id, 'complete_profile', 1);
  end if;
  return new;
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
  v_left integer;
  v_claim uuid;
  v_status text;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để đổi quà.';
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id and is_active = true
  for update;

  if v_reward.id is null then
    raise exception 'Phần thưởng không còn.';
  end if;
  if coalesce(v_reward.stock_quantity, 0) <= 0 then
    raise exception 'Phần thưởng đã hết.';
  end if;

  select coalesce(reward_points, 0) into v_points
  from public.profiles
  where id = v_user
  for update;

  if v_points < v_reward.point_cost then
    raise exception 'Bạn không đủ xu để đổi quà này!';
  end if;

  v_left := v_points - v_reward.point_cost;
  v_status := case
    when v_reward.type in ('app_balance', 'badge', 'boost', 'lucky_spin', 'mystery_box') then 'completed'
    else 'pending'
  end;

  update public.profiles
  set reward_points = v_left,
      wallet_balance = coalesce(wallet_balance, 0) + case
        when v_reward.type = 'app_balance' then v_reward.value
        else 0
      end
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
  where id = v_reward.id and stock_quantity > 0;
  if not found then
    raise exception 'Phần thưởng đã hết.';
  end if;

  insert into public.reward_claims (user_id, reward_id, status)
  values (v_user, v_reward.id, v_status)
  returning id into v_claim;

  begin
    insert into public.reward_redemptions (user_id, reward_id, points_spent, status)
    values (v_user, v_reward.id, v_reward.point_cost, v_status);
  exception when undefined_table then
    null;
  end;

  return jsonb_build_object(
    'claim_id', v_claim,
    'status', v_status,
    'points_left', v_left,
    'stock_left', v_reward.stock_quantity - 1
  );
end;
$$;

grant execute on function public.redeem_reward(uuid) to authenticated;
