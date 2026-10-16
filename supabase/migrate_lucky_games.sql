-- Vòng quay và hộp quà. Dán vào Supabase SQL Editor → Run.
-- Quản trị sửa giải và tỷ lệ trong mục Nhiệm vụ & Nhận quà.

alter table public.profiles add column if not exists id_verified boolean not null default false;
alter table public.profiles add column if not exists lucky_spins integer not null default 0;
alter table public.profiles add column if not exists mystery_boxes integer not null default 0;
alter table public.profiles add column if not exists reward_points integer not null default 0;

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

create table if not exists public.wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  prize_name text not null,
  prize_type text not null default 'coin' check (prize_type in ('coin', 'voucher', 'item')),
  value integer not null default 0 check (value >= 0),
  icon_url text,
  probability numeric not null default 1 check (probability >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mystery_prizes (
  id uuid primary key default gen_random_uuid(),
  prize_name text not null,
  prize_type text not null default 'coin' check (prize_type in ('coin', 'voucher', 'item')),
  value integer not null default 0 check (value >= 0),
  icon_url text,
  probability numeric not null default 1 check (probability >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.game_plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('wheel', 'box')),
  prize_name text not null,
  prize_type text not null,
  value integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists game_plays_user_idx on public.game_plays (user_id, created_at desc);

alter table public.wheel_prizes enable row level security;
alter table public.mystery_prizes enable row level security;
alter table public.game_plays enable row level security;

drop policy if exists "wheel_prizes_select" on public.wheel_prizes;
drop policy if exists "wheel_prizes_admin_write" on public.wheel_prizes;
drop policy if exists "mystery_prizes_select" on public.mystery_prizes;
drop policy if exists "mystery_prizes_admin_write" on public.mystery_prizes;
drop policy if exists "game_plays_select" on public.game_plays;

create policy "wheel_prizes_select" on public.wheel_prizes
  for select using (is_active = true or public.is_current_admin());
create policy "wheel_prizes_admin_write" on public.wheel_prizes
  for all using (public.is_current_admin()) with check (public.is_current_admin());

create policy "mystery_prizes_select" on public.mystery_prizes
  for select using (is_active = true or public.is_current_admin());
create policy "mystery_prizes_admin_write" on public.mystery_prizes
  for all using (public.is_current_admin()) with check (public.is_current_admin());

create policy "game_plays_select" on public.game_plays
  for select using (auth.uid() = user_id or public.is_current_admin());

grant select on public.wheel_prizes to anon, authenticated;
grant select, insert, update, delete on public.wheel_prizes to authenticated;
grant select on public.mystery_prizes to anon, authenticated;
grant select, insert, update, delete on public.mystery_prizes to authenticated;
grant select on public.game_plays to authenticated;

insert into public.wheel_prizes (prize_name, prize_type, value, probability, sort_order)
select * from (
  values
    ('50 xu', 'coin', 50, 40::numeric, 1),
    ('100 xu', 'coin', 100, 30::numeric, 2),
    ('200 xu', 'coin', 200, 18::numeric, 3),
    ('500 xu', 'coin', 500, 9::numeric, 4),
    ('1000 xu', 'coin', 1000, 3::numeric, 5)
) as seed(prize_name, prize_type, value, probability, sort_order)
where not exists (select 1 from public.wheel_prizes);

insert into public.mystery_prizes (prize_name, prize_type, value, probability, sort_order)
select * from (
  values
    ('200 xu', 'coin', 200, 50::numeric, 1),
    ('500 xu', 'coin', 500, 30::numeric, 2),
    ('1000 xu', 'coin', 1000, 15::numeric, 3),
    ('2000 xu', 'coin', 2000, 5::numeric, 4)
) as seed(prize_name, prize_type, value, probability, sort_order)
where not exists (select 1 from public.mystery_prizes);

drop function if exists public.reward_spin();
drop function if exists public.reward_open_box();

create or replace function public.reward_spin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_turns integer;
  v_total numeric;
  v_roll numeric;
  v_cursor numeric := 0;
  v_prize public.wheel_prizes%rowtype;
  v_points integer;
  v_left integer;
  v_found boolean := false;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để quay.';
  end if;

  select coalesce(lucky_spins, 0) into v_turns
  from public.profiles
  where id = v_user
  for update;

  if coalesce(v_turns, 0) <= 0 then
    raise exception 'Bạn chưa có lượt quay.';
  end if;

  select coalesce(sum(probability), 0) into v_total
  from public.wheel_prizes
  where is_active and probability > 0;

  if v_total <= 0 then
    raise exception 'Chưa có giải thưởng vòng quay.';
  end if;

  v_roll := random() * 100;

  for v_prize in
    select *
    from public.wheel_prizes
    where is_active and probability > 0
    order by sort_order, created_at, id
  loop
    v_cursor := v_cursor + (v_prize.probability / v_total) * 100;
    if v_cursor >= v_roll then
      v_found := true;
      exit;
    end if;
  end loop;

  if not v_found then
    select * into v_prize
    from public.wheel_prizes
    where is_active and probability > 0
    order by sort_order desc, created_at desc, id desc
    limit 1;
  end if;

  update public.profiles
  set lucky_spins = v_turns - 1,
      reward_points = coalesce(reward_points, 0) + case when v_prize.prize_type = 'coin' then v_prize.value else 0 end
  where id = v_user
  returning reward_points, lucky_spins into v_points, v_left;

  insert into public.game_plays (user_id, game, prize_name, prize_type, value)
  values (v_user, 'wheel', v_prize.prize_name, v_prize.prize_type, v_prize.value);

  return jsonb_build_object(
    'prize_id', v_prize.id,
    'prize_name', v_prize.prize_name,
    'prize_type', v_prize.prize_type,
    'value', v_prize.value,
    'points_left', v_points,
    'turns_left', v_left
  );
end;
$$;

create or replace function public.reward_open_box()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_turns integer;
  v_total numeric;
  v_roll numeric;
  v_cursor numeric := 0;
  v_prize public.mystery_prizes%rowtype;
  v_points integer;
  v_left integer;
  v_found boolean := false;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để mở hộp quà.';
  end if;

  select coalesce(mystery_boxes, 0) into v_turns
  from public.profiles
  where id = v_user
  for update;

  if coalesce(v_turns, 0) <= 0 then
    raise exception 'Bạn chưa có hộp quà.';
  end if;

  select coalesce(sum(probability), 0) into v_total
  from public.mystery_prizes
  where is_active and probability > 0;

  if v_total <= 0 then
    raise exception 'Chưa có giải trong hộp quà.';
  end if;

  v_roll := random() * 100;

  for v_prize in
    select *
    from public.mystery_prizes
    where is_active and probability > 0
    order by sort_order, created_at, id
  loop
    v_cursor := v_cursor + (v_prize.probability / v_total) * 100;
    if v_cursor >= v_roll then
      v_found := true;
      exit;
    end if;
  end loop;

  if not v_found then
    select * into v_prize
    from public.mystery_prizes
    where is_active and probability > 0
    order by sort_order desc, created_at desc, id desc
    limit 1;
  end if;

  update public.profiles
  set mystery_boxes = v_turns - 1,
      reward_points = coalesce(reward_points, 0) + case when v_prize.prize_type = 'coin' then v_prize.value else 0 end
  where id = v_user
  returning reward_points, mystery_boxes into v_points, v_left;

  insert into public.game_plays (user_id, game, prize_name, prize_type, value)
  values (v_user, 'box', v_prize.prize_name, v_prize.prize_type, v_prize.value);

  return jsonb_build_object(
    'prize_id', v_prize.id,
    'prize_name', v_prize.prize_name,
    'prize_type', v_prize.prize_type,
    'value', v_prize.value,
    'points_left', v_points,
    'turns_left', v_left
  );
end;
$$;

revoke all on function public.reward_spin() from public, anon;
revoke all on function public.reward_open_box() from public, anon;
grant execute on function public.reward_spin() to authenticated;
grant execute on function public.reward_open_box() to authenticated;
