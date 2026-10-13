-- Thông báo đẩy + bộ lọc việc làm.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Không xóa dữ liệu hiện có.
--
-- Gửi Expo Push: Database → Extensions → bật `pg_net` (nếu chưa có).
-- Hàng chờ `push_outbox` vẫn được ghi dù chưa bật pg_net.

create extension if not exists pg_net;

alter table public.profiles add column if not exists notify_push boolean not null default true;
alter table public.profiles add column if not exists notify_new_jobs boolean not null default true;
alter table public.profiles add column if not exists notify_new_bids boolean not null default true;
alter table public.profiles add column if not exists notify_wallet boolean not null default true;
alter table public.profiles add column if not exists notify_messages boolean not null default true;
alter table public.profiles add column if not exists notify_hired boolean not null default true;
alter table public.profiles add column if not exists notify_hire_cancelled boolean not null default true;
alter table public.profiles add column if not exists notify_reviews boolean not null default true;
alter table public.profiles add column if not exists notify_promo boolean not null default true;

alter table public.jobs add column if not exists category_id text;

create table if not exists public.job_alert_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  category_ids text[] not null default '{}',
  province_id text,
  ward_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null default 'unknown',
  updated_at timestamptz not null default now(),
  unique (token)
);

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  push_group text not null
    check (push_group in ('listing', 'wallet', 'jobs', 'promo')),
  kind text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  channel_id text not null,
  collapse_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'skipped', 'error')),
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id);
create index if not exists push_outbox_pending_idx on public.push_outbox (status, created_at);
create index if not exists jobs_category_idx on public.jobs (category_id);
create index if not exists jobs_area_idx on public.jobs (province_id, ward_id);
create index if not exists job_alert_settings_province_idx on public.job_alert_settings (province_id);

alter table public.job_alert_settings enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.push_outbox enable row level security;

drop policy if exists "job_alert_settings_own" on public.job_alert_settings;
drop policy if exists "device_push_tokens_own" on public.device_push_tokens;

create policy "job_alert_settings_own" on public.job_alert_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "device_push_tokens_own" on public.device_push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.job_alert_settings to authenticated;
grant select, insert, update, delete on public.device_push_tokens to authenticated;
grant select on public.push_outbox to authenticated;

create or replace function public.user_allows_push(
  p_profile public.profiles,
  p_group text,
  p_kind text
)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_profile.id is null then
    return false;
  end if;
  if coalesce(p_profile.notify_push, true) = false then
    return false;
  end if;

  if p_group = 'wallet' then
    return coalesce(p_profile.notify_wallet, true);
  elsif p_group = 'jobs' then
    return coalesce(p_profile.notify_new_jobs, true);
  elsif p_group = 'promo' then
    return coalesce(p_profile.notify_promo, true);
  elsif p_group = 'listing' then
    return case p_kind
      when 'bid' then coalesce(p_profile.notify_new_bids, true)
      when 'message' then coalesce(p_profile.notify_messages, true)
      when 'hired' then coalesce(p_profile.notify_hired, true)
      when 'hire_cancelled' then coalesce(p_profile.notify_hire_cancelled, true)
      when 'review' then coalesce(p_profile.notify_reviews, true)
      else true
    end;
  end if;

  return true;
end;
$$;

create or replace function public.enqueue_push(
  p_user_id uuid,
  p_group text,
  p_kind text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_channel text;
  v_collapse text;
begin
  if p_user_id is null then
    return;
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not public.user_allows_push(v_profile, p_group, p_kind) then
    return;
  end if;

  v_channel := case p_group
    when 'wallet' then 'viecnhanh-wallet'
    when 'jobs' then 'viecnhanh-jobs'
    when 'promo' then 'viecnhanh-promo'
    else 'viecnhanh-listing'
  end;
  v_collapse := p_group || '-' || p_user_id::text;

  insert into public.push_outbox (
    user_id, push_group, kind, title, body, data, channel_id, collapse_id
  ) values (
    p_user_id,
    p_group,
    p_kind,
    coalesce(nullif(trim(p_title), ''), 'Việc Nhanh'),
    coalesce(p_body, ''),
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object(
      'group', p_group,
      'kind', p_kind
    ),
    v_channel,
    v_collapse
  );
end;
$$;

create or replace function public.dispatch_push_outbox_row(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_row public.push_outbox;
  v_tokens jsonb;
  v_payload jsonb;
  v_request_id bigint;
begin
  select * into v_row from public.push_outbox where id = p_id;
  if v_row.id is null or v_row.status <> 'pending' then
    return;
  end if;

  select coalesce(jsonb_agg(t.token), '[]'::jsonb)
  into v_tokens
  from public.device_push_tokens t
  where t.user_id = v_row.user_id
    and t.token like 'ExponentPushToken[%';

  if v_tokens = '[]'::jsonb then
    update public.push_outbox
    set status = 'skipped', last_error = 'NO_DEVICE_TOKEN'
    where id = p_id;
    return;
  end if;

  v_payload := jsonb_build_object(
    'to', v_tokens,
    'title', v_row.title,
    'body', v_row.body,
    'sound', 'default',
    'priority', 'high',
    'channelId', v_row.channel_id,
    'badge', 1,
    'data', v_row.data
  );

  begin
    select net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json',
        'Accept-Encoding', 'gzip, deflate'
      ),
      body := v_payload,
      timeout_milliseconds := 8000
    )
    into v_request_id;

    update public.push_outbox
    set status = 'queued', last_error = coalesce(v_request_id::text, null)
    where id = p_id;
  exception when others then
    update public.push_outbox
    set status = 'error', last_error = sqlerrm
    where id = p_id;
  end;
end;
$$;

create or replace function public.dispatch_push_outbox_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_push_outbox_row(new.id);
  return new;
end;
$$;

drop trigger if exists push_outbox_dispatch on public.push_outbox;
create trigger push_outbox_dispatch
  after insert on public.push_outbox
  for each row execute function public.dispatch_push_outbox_trigger();

create or replace function public.notify_matching_workers(p_job public.jobs)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_body text;
begin
  if p_job.id is null then
    return;
  end if;
  if p_job.status <> 'approved' or coalesce(p_job.is_approved, false) = false then
    return;
  end if;

  v_body := coalesce(nullif(trim(p_job.title), ''), 'Có việc mới')
    || case
      when p_job.price is not null then format(' • %s đ', round(p_job.price)::text)
      else ''
    end;

  for v_user in
    select p.id
    from public.profiles p
    left join public.job_alert_settings s on s.user_id = p.id
    where p.id is distinct from p_job.user_id
      and public.user_allows_push(p, 'jobs', 'new_job')
      and (
        s.user_id is null
        or coalesce(cardinality(s.category_ids), 0) = 0
        or coalesce(p_job.category_id, '') = any (s.category_ids)
      )
      and (
        s.user_id is null
        or coalesce(s.province_id, '') = ''
        or s.province_id = p_job.province_id
      )
      and (
        s.user_id is null
        or coalesce(cardinality(s.ward_ids), 0) = 0
        or coalesce(p_job.ward_id, '') = any (s.ward_ids)
      )
  loop
    perform public.enqueue_push(
      v_user,
      'jobs',
      'new_job',
      'Việc mới phù hợp với bạn',
      v_body,
      jsonb_build_object(
        'screen', 'job',
        'jobId', p_job.id
      )
    );
  end loop;
end;
$$;

create or replace function public.notify_on_bid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = new.job_id;
  if v_job.user_id is null or v_job.user_id = new.worker_id then
    return new;
  end if;

  perform public.enqueue_push(
    v_job.user_id,
    'listing',
    'bid',
    'Có đề xuất mới',
    'Tin "' || left(coalesce(v_job.title, 'công việc'), 48) || '" vừa nhận một đề xuất.',
    jsonb_build_object('screen', 'job', 'jobId', v_job.id, 'bidId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists bids_enqueue_push on public.bids;
create trigger bids_enqueue_push
  after insert on public.bids
  for each row execute function public.notify_on_bid();

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
  v_target uuid;
begin
  if new.kind = 'system' then
    return new;
  end if;

  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv.id is null then
    return new;
  end if;

  v_target := case
    when new.sender_id = v_conv.poster_id then v_conv.worker_id
    else v_conv.poster_id
  end;

  if v_target is null or v_target = new.sender_id then
    return new;
  end if;

  perform public.enqueue_push(
    v_target,
    'listing',
    'message',
    'Có tin nhắn mới',
    left(coalesce(nullif(trim(new.body), ''), 'Bạn có tin nhắn mới trên Việc Nhanh.'), 120),
    jsonb_build_object(
      'screen', 'chat',
      'conversationId', v_conv.id,
      'jobId', v_conv.job_id
    )
  );
  return new;
end;
$$;

drop trigger if exists messages_enqueue_push on public.messages;
create trigger messages_enqueue_push
  after insert on public.messages
  for each row execute function public.notify_on_message();

create or replace function public.notify_on_job_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_open boolean;
  v_now_open boolean;
begin
  if tg_op = 'INSERT' then
    perform public.notify_matching_workers(new);
    return new;
  end if;

  if new.hired_worker_id is not null
     and old.hired_worker_id is distinct from new.hired_worker_id then
    perform public.enqueue_push(
      new.hired_worker_id,
      'listing',
      'hired',
      'Bạn được thuê',
      'Người đăng đã thuê bạn cho "' || left(coalesce(new.title, 'công việc'), 48) || '".',
      jsonb_build_object('screen', 'job', 'jobId', new.id)
    );
  end if;

  if old.hired_worker_id is not null
     and new.hired_worker_id is null then
    perform public.enqueue_push(
      old.hired_worker_id,
      'listing',
      'hire_cancelled',
      'Hủy thuê',
      'Tin "' || left(coalesce(new.title, 'công việc'), 48) || '" vừa hủy thuê.'
        || case
          when coalesce(new.hire_cancel_reason, '') <> '' then ' Lý do: ' || new.hire_cancel_reason
          else ''
        end,
      jsonb_build_object('screen', 'job', 'jobId', new.id)
    );
  end if;

  v_was_open := old.status = 'approved' and coalesce(old.is_approved, false);
  v_now_open := new.status = 'approved' and coalesce(new.is_approved, false);
  if v_now_open and not v_was_open then
    perform public.notify_matching_workers(new);
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_enqueue_push on public.jobs;
create trigger jobs_enqueue_push
  after insert or update on public.jobs
  for each row execute function public.notify_on_job_change();

create or replace function public.notify_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.worker_id is null or new.worker_id = new.reviewer_id then
    return new;
  end if;

  perform public.enqueue_push(
    new.worker_id,
    'listing',
    'review',
    'Bạn có đánh giá mới',
    format('Bạn vừa nhận %s sao%s.',
      coalesce(round(new.rating)::text, '?'),
      case when coalesce(trim(new.comment), '') <> '' then ': ' || left(trim(new.comment), 80) else '' end
    ),
    jsonb_build_object(
      'screen', 'user',
      'userId', new.worker_id,
      'jobId', new.job_id
    )
  );
  return new;
end;
$$;

drop trigger if exists reviews_enqueue_push on public.reviews;
create trigger reviews_enqueue_push
  after insert on public.reviews
  for each row execute function public.notify_on_review();

create or replace function public.notify_on_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric;
begin
  if new.wallet_balance is not distinct from old.wallet_balance then
    return new;
  end if;

  v_delta := coalesce(new.wallet_balance, 0) - coalesce(old.wallet_balance, 0);

  perform public.enqueue_push(
    new.id,
    'wallet',
    'balance',
    'Biến động số dư ví',
    case
      when v_delta > 0 then format('Ví vừa cộng %s đ. Số dư hiện tại: %s đ.', round(v_delta)::text, round(new.wallet_balance)::text)
      else format('Ví vừa trừ %s đ. Số dư hiện tại: %s đ.', round(abs(v_delta))::text, round(new.wallet_balance)::text)
    end,
    jsonb_build_object('screen', 'payments')
  );
  return new;
end;
$$;

drop trigger if exists profiles_wallet_enqueue_push on public.profiles;
create trigger profiles_wallet_enqueue_push
  after update of wallet_balance on public.profiles
  for each row execute function public.notify_on_wallet();

revoke all on function public.enqueue_push(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.dispatch_push_outbox_row(uuid) from public, anon, authenticated;
revoke all on function public.notify_matching_workers(public.jobs) from public, anon, authenticated;
