-- Sửa push token + bật Realtime cho tin đăng.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Không xóa dữ liệu hiện có.
--
-- Sau khi chạy: Database → Extensions → chắc chắn `pg_net` đang bật.
-- Realtime: Database → Publications → supabase_realtime có bảng public.jobs.

create extension if not exists pg_net;

-- Token thiết bị: hỗ trợ cả bảng cũ (id PK) lẫn bảng đã đổi token thành PK.
alter table public.device_push_tokens add column if not exists user_id uuid;
alter table public.device_push_tokens add column if not exists platform text not null default 'unknown';
alter table public.device_push_tokens add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.device_push_tokens'::regclass
      and contype in ('p', 'u')
      and pg_get_constraintdef(oid) ilike '%(token)%'
  ) and not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'device_push_tokens'
      and indexdef ilike '%unique%'
      and indexdef ilike '%token%'
  ) then
    create unique index device_push_tokens_token_key on public.device_push_tokens (token);
  end if;
end $$;

drop policy if exists "device_push_tokens_own" on public.device_push_tokens;
drop policy if exists "Allow users to upsert their own device tokens" on public.device_push_tokens;
create policy "device_push_tokens_own" on public.device_push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.device_push_tokens to authenticated;
grant usage on schema net to postgres, service_role;

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

create or replace function public.dispatch_pending_push_outbox(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id
    from public.push_outbox
    where status in ('pending', 'error')
    order by created_at asc
    limit greatest(coalesce(p_limit, 25), 1)
  loop
    update public.push_outbox set status = 'pending' where id = v_id;
    perform public.dispatch_push_outbox_row(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
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

revoke all on function public.dispatch_push_outbox_row(uuid) from public, anon, authenticated;
grant execute on function public.dispatch_pending_push_outbox(integer) to postgres, service_role;

create or replace function public.upsert_device_push_token(
  p_token text,
  p_platform text default 'unknown'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_platform text := coalesce(nullif(trim(p_platform), ''), 'unknown');
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để lưu push token.';
  end if;
  if p_token is null or p_token not like 'ExponentPushToken[%' then
    raise exception 'Expo Push Token không hợp lệ.';
  end if;

  update public.device_push_tokens
  set user_id = v_user,
      platform = v_platform,
      updated_at = now()
  where token = p_token;

  if found then
    return;
  end if;

  begin
    insert into public.device_push_tokens (user_id, token, platform, updated_at)
    values (v_user, p_token, v_platform, now());
  exception when unique_violation then
    update public.device_push_tokens
    set user_id = v_user,
        platform = v_platform,
        updated_at = now()
    where token = p_token;
  end;
end;
$$;

revoke all on function public.upsert_device_push_token(text, text) from public, anon;
grant execute on function public.upsert_device_push_token(text, text) to authenticated;
