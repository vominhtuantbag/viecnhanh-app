-- Nhiệm vụ và đổi quà. Dán vào Supabase SQL Editor → Run.
-- Không xoá tin đăng, ví hay nhiệm vụ cũ.

alter table public.profiles add column if not exists reward_points integer not null default 0;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  action_type text not null default 'complete_job'
    check (action_type in ('complete_job', 'post_job', 'daily_checkin', 'refer_user')),
  target_count integer not null default 1 check (target_count > 0),
  reward_points integer not null default 0 check (reward_points >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  current_count integer not null default 0,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'claimed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, task_id)
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'voucher'
    check (type in ('phone_card', 'voucher', 'app_balance', 'physical_gift')),
  point_cost integer not null default 0 check (point_cost >= 0),
  value numeric not null default 0,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'rejected')),
  claim_code text,
  created_at timestamptz not null default now()
);

create index if not exists user_tasks_user_idx on public.user_tasks (user_id);
create index if not exists reward_claims_user_idx on public.reward_claims (user_id);

alter table public.tasks enable row level security;
alter table public.user_tasks enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_claims enable row level security;

drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_admin_write" on public.tasks;
drop policy if exists "rewards_select" on public.rewards;
drop policy if exists "rewards_admin_write" on public.rewards;
drop policy if exists "user_tasks_own" on public.user_tasks;
drop policy if exists "reward_claims_select" on public.reward_claims;
drop policy if exists "reward_claims_admin_write" on public.reward_claims;

create policy "tasks_select" on public.tasks
  for select using (is_active = true or public.is_current_admin());
create policy "tasks_admin_write" on public.tasks
  for all using (public.is_current_admin()) with check (public.is_current_admin());

create policy "rewards_select" on public.rewards
  for select using (is_active = true or public.is_current_admin());
create policy "rewards_admin_write" on public.rewards
  for all using (public.is_current_admin()) with check (public.is_current_admin());

create policy "user_tasks_own" on public.user_tasks
  for select using (auth.uid() = user_id or public.is_current_admin());

create policy "reward_claims_select" on public.reward_claims
  for select using (auth.uid() = user_id or public.is_current_admin());
create policy "reward_claims_admin_write" on public.reward_claims
  for all using (public.is_current_admin()) with check (public.is_current_admin());

grant select on public.tasks to anon, authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.user_tasks to authenticated;
grant select on public.rewards to anon, authenticated;
grant select, insert, update, delete on public.rewards to authenticated;
grant select, insert, update, delete on public.reward_claims to authenticated;

alter table public.tasks add column if not exists group_key text not null default 'core';
alter table public.tasks add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.rewards add column if not exists group_key text not null default 'wallet';
alter table public.rewards add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.user_tasks add column if not exists pending_points integer not null default 0;
alter table public.profiles add column if not exists reward_streak integer not null default 0;
alter table public.profiles add column if not exists last_checkin_date date;
alter table public.profiles add column if not exists lucky_spins integer not null default 0;
alter table public.profiles add column if not exists mystery_boxes integer not null default 0;
alter table public.profiles add column if not exists boost_credits integer not null default 0;
alter table public.profiles add column if not exists badges text[] not null default '{}';

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'tasks' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%action_type%'
  loop
    execute format('alter table public.tasks drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.tasks drop constraint if exists tasks_action_type_check;
alter table public.tasks add constraint tasks_action_type_check
  check (action_type in (
    'complete_job', 'post_job', 'daily_checkin', 'refer_user',
    'golden_hour', 'browse_jobs', 'share_job', 'complete_profile',
    'apply_job', 'five_star', 'write_review'
  ));

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'rewards' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%type%'
  loop
    execute format('alter table public.rewards drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.rewards drop constraint if exists rewards_type_check;
alter table public.rewards add constraint rewards_type_check
  check (type in (
    'phone_card', 'voucher', 'app_balance', 'physical_gift',
    'data_4g', 'partner_voucher', 'badge', 'boost', 'lucky_spin', 'mystery_box'
  ));

update public.tasks
set title = 'Điểm danh chuỗi 7 ngày',
    description = 'Điểm danh mỗi ngày. Ngày 1 nhận 100 xu, ngày 7 nhận 1.000 xu kèm vé quay may mắn. Ngày 3 và ngày 7 còn có hộp quà bí mật.',
    target_count = 7,
    reward_points = 100,
    group_key = 'daily',
    meta = '{"period":"streak"}'::jsonb
where action_type = 'daily_checkin';

insert into public.tasks (title, description, action_type, target_count, reward_points, group_key, meta)
select seed.title, seed.description, seed.action_type, seed.target_count, seed.reward_points, seed.group_key, seed.meta::jsonb
from (values
  ('Điểm danh chuỗi 7 ngày', 'Điểm danh mỗi ngày. Ngày 1 nhận 100 xu, ngày 7 nhận 1.000 xu kèm vé quay may mắn. Ngày 3 và ngày 7 còn có hộp quà bí mật.', 'daily_checkin', 7, 100, 'daily', '{"period":"streak"}'),
  ('Khung giờ vàng', 'Mở app, đăng tin hoặc xem việc trong khung 11:30–13:00 hoặc 19:00–20:00.', 'golden_hour', 1, 50, 'daily', '{"period":"day"}'),
  ('Khám phá việc mới', 'Xem ít nhất 5 tin việc khác nhau trong ngày.', 'browse_jobs', 5, 30, 'explore', '{"period":"day"}'),
  ('Chia sẻ công việc', 'Chia sẻ một tin việc. Nhiệm vụ được tính khi bạn chia sẻ hoặc khi có người khác xem tin của bạn trong ngày.', 'share_job', 1, 40, 'explore', '{"period":"day"}'),
  ('Hoàn thiện hồ sơ', 'Cập nhật họ tên, số điện thoại, và thêm kỹ năng hoặc xác minh giấy tờ.', 'complete_profile', 1, 80, 'explore', '{}'),
  ('Ứng tuyển chăm chỉ', 'Gửi đề xuất cho 3 công việc trong ngày.', 'apply_job', 3, 60, 'core', '{"period":"day"}'),
  ('Hoàn thành 3 việc', 'Làm xong 3 công việc với vai trò người nhận việc.', 'complete_job', 3, 150, 'core', '{}'),
  ('Hoàn thành xuất sắc', 'Được đánh giá 5 sao sau khi công việc đã hoàn thành.', 'five_star', 1, 200, 'core', '{}'),
  ('Viết đánh giá', 'Viết nhận xét cho đối tác sau khi công việc kết thúc.', 'write_review', 1, 40, 'core', '{}'),
  ('Đăng 1 tin tìm người giúp', 'Đăng một tin việc mới trên Việc Nhanh.', 'post_job', 1, 20, 'core', '{}'),
  ('Mời 1 người bạn', 'Một người dùng mã giới thiệu của bạn khi đăng ký.', 'refer_user', 1, 100, 'referral', '{}')
) as seed(title, description, action_type, target_count, reward_points, group_key, meta)
where not exists (select 1 from public.tasks t where t.title = seed.title);

insert into public.rewards (title, type, point_cost, value, stock_quantity, group_key, meta)
select seed.title, seed.type, seed.point_cost, seed.value, seed.stock_quantity, seed.group_key, seed.meta::jsonb
from (values
  ('Cộng 10.000đ vào ví', 'app_balance', 200, 10000, 999, 'wallet', '{}'),
  ('Cộng 20.000đ vào ví', 'app_balance', 380, 20000, 999, 'wallet', '{}'),
  ('Cộng 50.000đ vào ví', 'app_balance', 900, 50000, 200, 'wallet', '{}'),
  ('Voucher đẩy tin lên top', 'voucher', 120, 0, 100, 'perk', '{"kind":"boost_top"}'),
  ('Voucher giảm phí hoa hồng', 'voucher', 150, 20000, 100, 'perk', '{"kind":"fee_off"}'),
  ('Huy hiệu Ứng viên ưu tú', 'badge', 300, 0, 999, 'perk', '{"badge":"top_worker"}'),
  ('Huy hiệu Nhà tuyển dụng uy tín', 'badge', 300, 0, 999, 'perk', '{"badge":"trusted_poster"}'),
  ('1 lượt đẩy tin miễn phí', 'boost', 80, 1, 500, 'perk', '{"turns":1}'),
  ('Thẻ cào Viettel 10k', 'phone_card', 180, 10000, 50, 'life', '{"network":"viettel"}'),
  ('Thẻ cào Viettel 20k', 'phone_card', 340, 20000, 30, 'life', '{"network":"viettel"}'),
  ('Thẻ cào Viettel 50k', 'phone_card', 800, 50000, 10, 'life', '{"network":"viettel"}'),
  ('Thẻ cào Mobifone 10k', 'phone_card', 180, 10000, 30, 'life', '{"network":"mobifone"}'),
  ('Thẻ cào Vinaphone 10k', 'phone_card', 180, 10000, 30, 'life', '{"network":"vinaphone"}'),
  ('Data 4G 1GB', 'data_4g', 160, 10000, 40, 'life', '{}'),
  ('Voucher ăn uống 20k', 'partner_voucher', 160, 20000, 40, 'life', '{}'),
  ('Voucher ví điện tử 20k', 'partner_voucher', 180, 20000, 40, 'life', '{}'),
  ('1 lượt vòng quay may mắn', 'lucky_spin', 50, 0, 999, 'luck', '{}'),
  ('1 hộp quà bí mật', 'mystery_box', 120, 0, 999, 'luck', '{}')
) as seed(title, type, point_cost, value, stock_quantity, group_key, meta)
where not exists (select 1 from public.rewards r where r.title = seed.title);

update public.tasks set group_key = 'daily' where action_type in ('daily_checkin', 'golden_hour');
update public.tasks set group_key = 'explore' where action_type in ('browse_jobs', 'share_job', 'complete_profile');
update public.tasks set group_key = 'referral' where action_type = 'refer_user';
update public.tasks set group_key = 'core' where action_type in ('apply_job', 'complete_job', 'five_star', 'write_review', 'post_job');
update public.rewards set group_key = 'life' where type in ('phone_card', 'data_4g', 'partner_voucher');
update public.rewards set group_key = 'perk' where type in ('voucher', 'badge', 'boost');
update public.rewards set group_key = 'luck' where type in ('lucky_spin', 'mystery_box');
update public.rewards set group_key = 'wallet' where type = 'app_balance';

create or replace function public.bump_reward_progress(p_user uuid, p_action text, p_delta integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_count integer;
  v_today date := (timezone('Asia/Ho_Chi_Minh', now()))::date;
begin
  if p_user is null or coalesce(p_delta, 0) <= 0 or p_action = 'daily_checkin' then
    return;
  end if;

  for v_task in
    select * from public.tasks
    where is_active = true and action_type = p_action
  loop
    if coalesce(v_task.meta->>'period', '') = 'day' then
      update public.user_tasks
      set current_count = 0,
          status = 'in_progress',
          completed_at = null,
          pending_points = 0,
          updated_at = now()
      where user_id = p_user
        and task_id = v_task.id
        and (updated_at at time zone 'Asia/Ho_Chi_Minh')::date < v_today;
    end if;

    insert into public.user_tasks (user_id, task_id, current_count, status)
    values (p_user, v_task.id, least(p_delta, v_task.target_count), 'in_progress')
    on conflict (user_id, task_id) do update
      set current_count = least(public.user_tasks.current_count + p_delta, v_task.target_count),
          updated_at = now()
      where public.user_tasks.status <> 'claimed';

    select current_count into v_count
    from public.user_tasks
    where user_id = p_user and task_id = v_task.id;

    if v_count >= v_task.target_count then
      update public.user_tasks
      set status = 'completed',
          completed_at = coalesce(completed_at, now()),
          updated_at = now()
      where user_id = p_user
        and task_id = v_task.id
        and status = 'in_progress';
    end if;
  end loop;
end;
$$;

create or replace function public.is_golden_hour()
returns boolean
language sql
stable
as $$
  select (
    ((timezone('Asia/Ho_Chi_Minh', now()))::time >= time '11:30' and (timezone('Asia/Ho_Chi_Minh', now()))::time < time '13:00')
    or ((timezone('Asia/Ho_Chi_Minh', now()))::time >= time '19:00' and (timezone('Asia/Ho_Chi_Minh', now()))::time < time '20:00')
  );
$$;

create or replace function public.on_job_reward_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.bump_reward_progress(new.user_id, 'post_job', 1);
    if public.is_golden_hour() then
      perform public.bump_reward_progress(new.user_id, 'golden_hour', 1);
    end if;
  elsif tg_op = 'UPDATE'
    and new.status = 'completed'
    and old.status is distinct from 'completed'
    and new.hired_worker_id is not null then
    perform public.bump_reward_progress(new.hired_worker_id, 'complete_job', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_reward_progress on public.jobs;
create trigger jobs_reward_progress
  after insert or update of status on public.jobs
  for each row execute function public.on_job_reward_progress();

create or replace function public.on_referral_reward_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_reward_progress(new.inviter_id, 'refer_user', 1);
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.referrals') is not null then
    drop trigger if exists referrals_reward_progress on public.referrals;
    create trigger referrals_reward_progress
      after insert on public.referrals
      for each row execute function public.on_referral_reward_progress();
  end if;
end $$;

create or replace function public.on_bid_reward_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_reward_progress(new.worker_id, 'apply_job', 1);
  return new;
end;
$$;

drop trigger if exists bids_reward_progress on public.bids;
create trigger bids_reward_progress
  after insert on public.bids
  for each row execute function public.on_bid_reward_progress();

create or replace function public.on_review_reward_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform public.bump_reward_progress(new.reviewer_id, 'write_review', 1);
  if coalesce(new.rating, 0) >= 5 and new.worker_id is not null then
    select status into v_status from public.jobs where id = new.job_id;
    if v_status = 'completed' then
      perform public.bump_reward_progress(new.worker_id, 'five_star', 1);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_reward_progress on public.reviews;
create trigger reviews_reward_progress
  after insert on public.reviews
  for each row execute function public.on_review_reward_progress();

create or replace function public.on_view_reward_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.jobs where id = new.job_id;
  if new.viewer_id is not null and new.viewer_id is distinct from v_owner then
    perform public.bump_reward_progress(new.viewer_id, 'browse_jobs', 1);
    if public.is_golden_hour() then
      perform public.bump_reward_progress(new.viewer_id, 'golden_hour', 1);
    end if;
    if v_owner is not null then
      perform public.bump_reward_progress(v_owner, 'share_job', 1);
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.job_views') is not null then
    drop trigger if exists job_views_reward_progress on public.job_views;
    create trigger job_views_reward_progress
      after insert on public.job_views
      for each row execute function public.on_view_reward_progress();
  end if;
end $$;

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

drop trigger if exists profiles_reward_progress on public.profiles;
create trigger profiles_reward_progress
  after insert or update on public.profiles
  for each row execute function public.on_profile_reward_progress();

create or replace function public.reward_record_action(p_action text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Cần đăng nhập.';
  end if;
  if p_action = 'daily_checkin' then
    return public.reward_daily_checkin();
  end if;
  if p_action = 'golden_hour' and not public.is_golden_hour() then
    return 0;
  end if;
  perform public.bump_reward_progress(v_user, p_action, 1);
  return 1;
end;
$$;

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
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để điểm danh.';
  end if;

  select * into v_task
  from public.tasks
  where is_active = true and action_type = 'daily_checkin'
  order by created_at
  limit 1;

  if v_task.id is null then
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

  update public.profiles
  set reward_streak = v_streak,
      last_checkin_date = v_today
  where id = v_user;

  insert into public.user_tasks (user_id, task_id, current_count, status, pending_points, completed_at)
  values (v_user, v_task.id, v_day, 'completed', v_points, now())
  on conflict (user_id, task_id) do update
    set current_count = v_day,
        status = 'completed',
        pending_points = v_points,
        completed_at = now(),
        updated_at = now();

  return v_points;
end;
$$;

drop function if exists public.claim_reward_task(uuid);

create or replace function public.claim_reward_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_task public.tasks;
  v_row public.user_tasks;
  v_gain integer;
  v_spin boolean := false;
  v_box boolean := false;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để nhận xu.';
  end if;

  select * into v_task from public.tasks where id = p_task_id and is_active = true;
  if v_task.id is null then
    raise exception 'Không tìm thấy nhiệm vụ.';
  end if;

  select * into v_row from public.user_tasks where user_id = v_user and task_id = v_task.id for update;
  if v_row.id is null or v_row.status = 'in_progress' then
    raise exception 'Bạn chưa hoàn thành nhiệm vụ này.';
  end if;
  if v_row.status = 'claimed' then
    raise exception 'Bạn đã nhận xu nhiệm vụ này rồi.';
  end if;
  if v_task.action_type <> 'daily_checkin' and v_row.current_count < v_task.target_count then
    raise exception 'Bạn chưa hoàn thành nhiệm vụ này.';
  end if;

  v_gain := case when coalesce(v_row.pending_points, 0) > 0 then v_row.pending_points else v_task.reward_points end;
  if v_task.action_type = 'daily_checkin' and v_row.current_count = 7 then
    v_spin := true;
  end if;
  if v_task.action_type = 'daily_checkin' and v_row.current_count in (3, 7) then
    v_box := true;
  end if;

  update public.user_tasks
  set status = 'claimed',
      pending_points = 0,
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = v_row.id;

  update public.profiles
  set reward_points = coalesce(reward_points, 0) + v_gain,
      lucky_spins = coalesce(lucky_spins, 0) + case when v_spin then 1 else 0 end,
      mystery_boxes = coalesce(mystery_boxes, 0) + case when v_box then 1 else 0 end
  where id = v_user;

  return jsonb_build_object('points', v_gain, 'lucky_spin', v_spin, 'mystery_box', v_box);
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
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để đổi quà.';
  end if;

  select * into v_reward from public.rewards where id = p_reward_id and is_active = true for update;
  if v_reward.id is null then
    raise exception 'Phần thưởng không còn.';
  end if;
  if v_reward.stock_quantity <= 0 then
    raise exception 'Phần thưởng đã hết.';
  end if;

  select coalesce(reward_points, 0) into v_points from public.profiles where id = v_user for update;
  if v_points < v_reward.point_cost then
    raise exception 'Bạn chưa đủ xu để đổi quà này.';
  end if;

  update public.profiles
  set reward_points = v_points - v_reward.point_cost,
      wallet_balance = coalesce(wallet_balance, 0) + case when v_reward.type = 'app_balance' then v_reward.value else 0 end,
      lucky_spins = coalesce(lucky_spins, 0) + case when v_reward.type = 'lucky_spin' then 1 else 0 end,
      mystery_boxes = coalesce(mystery_boxes, 0) + case when v_reward.type = 'mystery_box' then 1 else 0 end,
      boost_credits = coalesce(boost_credits, 0) + case
        when v_reward.type = 'boost' then greatest(1, coalesce((v_reward.meta->>'turns')::integer, 1))
        else 0
      end,
      badges = case
        when v_reward.type = 'badge'
          and coalesce(v_reward.meta->>'badge', '') <> ''
          and not (coalesce(badges, '{}') @> array[v_reward.meta->>'badge'])
          then coalesce(badges, '{}') || array[v_reward.meta->>'badge']
        else badges
      end
  where id = v_user;

  update public.rewards
  set stock_quantity = stock_quantity - 1
  where id = v_reward.id;

  insert into public.reward_claims (user_id, reward_id, status, claim_code)
  values (
    v_user,
    v_reward.id,
    case
      when v_reward.type in ('app_balance', 'badge', 'boost', 'lucky_spin', 'mystery_box') then 'completed'
      else 'pending'
    end,
    null
  )
  returning * into v_claim;

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'status', v_claim.status,
    'claim_code', v_claim.claim_code,
    'points_left', v_points - v_reward.point_cost
  );
end;
$$;

create or replace function public.reward_spin()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_spins integer;
  v_roll integer;
  v_prize integer;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để quay.';
  end if;
  select coalesce(lucky_spins, 0) into v_spins from public.profiles where id = v_user for update;
  if v_spins <= 0 then
    raise exception 'Bạn chưa có lượt quay.';
  end if;
  v_roll := floor(random() * 100)::integer;
  v_prize := case
    when v_roll < 40 then 50
    when v_roll < 70 then 100
    when v_roll < 88 then 200
    when v_roll < 97 then 500
    else 1000
  end;
  update public.profiles
  set lucky_spins = v_spins - 1,
      reward_points = coalesce(reward_points, 0) + v_prize
  where id = v_user;
  return v_prize;
end;
$$;

create or replace function public.reward_open_box()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_boxes integer;
  v_roll integer;
  v_prize integer;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để mở hộp quà.';
  end if;
  select coalesce(mystery_boxes, 0) into v_boxes from public.profiles where id = v_user for update;
  if v_boxes <= 0 then
    raise exception 'Bạn chưa có hộp quà.';
  end if;
  v_roll := floor(random() * 100)::integer;
  v_prize := case
    when v_roll < 50 then 200
    when v_roll < 80 then 500
    when v_roll < 95 then 1000
    else 2000
  end;
  update public.profiles
  set mystery_boxes = v_boxes - 1,
      reward_points = coalesce(reward_points, 0) + v_prize
  where id = v_user;
  return v_prize;
end;
$$;

revoke all on function public.bump_reward_progress(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reward_daily_checkin() to authenticated;
grant execute on function public.reward_record_action(text) to authenticated;
grant execute on function public.claim_reward_task(uuid) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.reward_spin() to authenticated;
grant execute on function public.reward_open_box() to authenticated;
grant execute on function public.is_current_admin() to authenticated;
grant execute on function public.is_golden_hour() to authenticated;
