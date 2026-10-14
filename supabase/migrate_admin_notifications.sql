-- Chiến dịch thông báo đẩy cho quản trị (marketing, khuyến mãi, giữ chân người dùng).
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Không xóa người dùng, tin đăng hay thông báo cũ.
--
-- Gửi đi qua hàng chờ push_outbox sẵn có (Expo Push: https://exp.host/--/api/v2/push/send).
-- Cần extension pg_net (Database → Extensions).
-- Lịch tự chạy mỗi phút cần pg_cron. Nếu chưa bật được, mở màn "Gửi thông báo"
-- trong quản trị cũng sẽ gửi các chiến dịch đã đến giờ.

create extension if not exists pg_net;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_url text,
  action_url text,
  audience text not null default 'all'
    check (audience in ('all', 'users')),
  targets jsonb not null default '[]'::jsonb,
  target_label text not null default 'Tất cả',
  send_mode text not null default 'now'
    check (send_mode in ('now', 'schedule')),
  scheduled_at timestamptz,
  send_time time not null default time '09:00',
  recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  weekday smallint
    check (weekday is null or weekday between 1 and 7),
  month_day smallint
    check (month_day is null or month_day between 1 and 31),
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'sent', 'error')),
  last_sent_at timestamptz,
  next_run_at timestamptz,
  sent_count integer not null default 0,
  last_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_notifications_due_idx
  on public.admin_notifications (next_run_at)
  where status in ('pending', 'scheduled');

alter table public.admin_notifications enable row level security;

drop policy if exists "admin_notifications_admin_read" on public.admin_notifications;
create policy "admin_notifications_admin_read" on public.admin_notifications
  for select to authenticated
  using (public.is_current_admin());

grant select on public.admin_notifications to authenticated;
revoke insert, update, delete on public.admin_notifications from anon, authenticated;

create or replace function public.admin_notification_next_run(
  p_after timestamptz,
  p_send_time time,
  p_recurrence text,
  p_weekday smallint,
  p_month_day smallint,
  p_anchor timestamptz
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_local timestamp;
  v_date date;
  v_year int;
  v_month int;
  v_day int;
  v_dim int;
  v_guard int := 0;
  v_clock time := coalesce(p_send_time, time '09:00');
begin
  if coalesce(p_recurrence, 'none') = 'none' then
    return null;
  end if;

  v_local := p_after at time zone 'Asia/Ho_Chi_Minh';

  if p_recurrence = 'daily' then
    return (((v_local::date + 1)::timestamp + v_clock) at time zone 'Asia/Ho_Chi_Minh');
  end if;

  if p_recurrence = 'weekly' then
    if p_weekday is null or p_weekday < 1 or p_weekday > 7 then
      return null;
    end if;
    v_date := v_local::date + 1;
    while extract(isodow from v_date)::int <> p_weekday loop
      v_date := v_date + 1;
      v_guard := v_guard + 1;
      if v_guard > 8 then
        return null;
      end if;
    end loop;
    return ((v_date::timestamp + v_clock) at time zone 'Asia/Ho_Chi_Minh');
  end if;

  if p_recurrence = 'monthly' then
    if p_month_day is null or p_month_day < 1 or p_month_day > 31 then
      return null;
    end if;
    v_date := (date_trunc('month', v_local) + interval '1 month')::date;
    v_dim := extract(day from (v_date + interval '1 month' - interval '1 day'))::int;
    v_day := least(p_month_day::int, v_dim);
    return (((v_date + (v_day - 1))::timestamp + v_clock) at time zone 'Asia/Ho_Chi_Minh');
  end if;

  if p_recurrence = 'yearly' then
    v_local := coalesce(p_anchor, p_after) at time zone 'Asia/Ho_Chi_Minh';
    v_month := extract(month from v_local)::int;
    v_day := extract(day from v_local)::int;
    v_year := extract(year from (p_after at time zone 'Asia/Ho_Chi_Minh'))::int + 1;
    begin
      v_date := make_date(v_year, v_month, v_day);
    exception when others then
      v_date := make_date(v_year, v_month, 28);
    end;
    return ((v_date::timestamp + v_clock) at time zone 'Asia/Ho_Chi_Minh');
  end if;

  return null;
end;
$$;

create or replace function public.run_admin_notification(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.admin_notifications;
  v_user uuid;
  v_count integer := 0;
  v_data jsonb;
  v_next timestamptz;
  v_image text;
begin
  select * into v from public.admin_notifications where id = p_id for update;
  if v.id is null then
    raise exception 'Không tìm thấy chiến dịch';
  end if;
  if v.status = 'sent' and v.recurrence = 'none' and v.next_run_at is null then
    return 0;
  end if;

  v_image := nullif(trim(coalesce(v.image_url, '')), '');
  v_data := jsonb_strip_nulls(jsonb_build_object(
    'screen', 'link',
    'url', nullif(trim(coalesce(v.action_url, '')), ''),
    'image', v_image,
    'campaignId', v.id::text
  ));

  for v_user in
    select p.id
    from public.profiles p
    where public.user_allows_push(p, 'promo', 'campaign')
      and (
        v.audience = 'all'
        or p.id in (
          select (item->>'id')::uuid
          from jsonb_array_elements(coalesce(v.targets, '[]'::jsonb)) item
          where coalesce(item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
      )
  loop
    perform public.enqueue_push(
      v_user,
      'promo',
      'campaign',
      v.title,
      v.body,
      v_data
    );
    v_count := v_count + 1;
  end loop;

  v_next := public.admin_notification_next_run(
    now(),
    v.send_time,
    v.recurrence,
    v.weekday,
    v.month_day,
    v.scheduled_at
  );

  update public.admin_notifications
  set
    status = case when v_next is null then 'sent' else 'scheduled' end,
    last_sent_at = now(),
    next_run_at = v_next,
    sent_count = sent_count + 1,
    last_error = case
      when v_count = 0 then 'Không có ai đang bật thông báo khuyến mãi, hoặc chưa chọn đúng người.'
      else null
    end,
    updated_at = now()
  where id = p_id;

  return v_count;
end;
$$;

create or replace function public.admin_save_notification_campaign(p_payload jsonb)
returns public.admin_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing public.admin_notifications;
  v_row public.admin_notifications;
  v_title text;
  v_body text;
  v_image text;
  v_url text;
  v_audience text;
  v_targets jsonb := '[]'::jsonb;
  v_label text;
  v_mode text;
  v_recurrence text;
  v_weekday smallint;
  v_month_day smallint;
  v_scheduled timestamptz;
  v_send_time time;
  v_status text;
begin
  if not public.is_current_admin() then
    raise exception 'Không có quyền quản trị';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Thiếu nội dung chiến dịch.';
  end if;

  v_title := trim(coalesce(p_payload->>'title', ''));
  v_body := trim(coalesce(p_payload->>'body', ''));
  v_image := nullif(trim(coalesce(p_payload->>'image_url', '')), '');
  v_url := nullif(trim(coalesce(p_payload->>'action_url', '')), '');
  v_audience := coalesce(nullif(p_payload->>'audience', ''), 'all');
  v_mode := coalesce(nullif(p_payload->>'send_mode', ''), 'now');
  v_recurrence := coalesce(nullif(p_payload->>'recurrence', ''), 'none');

  if v_title = '' then
    raise exception 'Nhập tiêu đề thông báo.';
  end if;
  if char_length(v_title) > 120 then
    raise exception 'Tiêu đề tối đa 120 ký tự.';
  end if;
  if v_body = '' then
    raise exception 'Nhập nội dung thông báo.';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'Nội dung tối đa 500 ký tự.';
  end if;
  if v_audience not in ('all', 'users') then
    raise exception 'Đối tượng nhận không hợp lệ.';
  end if;
  if v_mode not in ('now', 'schedule') then
    raise exception 'Cách gửi không hợp lệ.';
  end if;
  if v_recurrence not in ('none', 'daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'Chu kỳ lặp không hợp lệ.';
  end if;
  if v_image is not null and (v_image !~* '^https://' or char_length(v_image) > 2000) then
    raise exception 'Ảnh cần là đường dẫn https://, không quá dài.';
  end if;
  if v_url is not null and (v_url !~* '^(/|https://)' or char_length(v_url) > 500) then
    raise exception 'Link cần bắt đầu bằng / hoặc https://';
  end if;

  if v_audience = 'users' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', picked.id,
      'name', picked.name,
      'phone', picked.phone
    )), '[]'::jsonb)
    into v_targets
    from (
      select distinct on (item->>'id')
        item->>'id' as id,
        left(coalesce(item->>'name', ''), 80) as name,
        left(coalesce(item->>'phone', ''), 20) as phone
      from jsonb_array_elements(coalesce(p_payload->'targets', '[]'::jsonb)) item
      where coalesce(item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      order by item->>'id'
    ) picked;

    if v_targets is null then
      v_targets := '[]'::jsonb;
    end if;
    if jsonb_array_length(v_targets) = 0 then
      raise exception 'Chọn ít nhất một người nhận.';
    end if;
    if jsonb_array_length(v_targets) > 50 then
      raise exception 'Chỉ chọn tối đa 50 người. Muốn gửi rộng hơn, hãy chọn Gửi tất cả.';
    end if;

    select string_agg(coalesce(nullif(item->>'name', ''), 'Người dùng'), ', ')
    into v_label
    from jsonb_array_elements(v_targets) item;
    if v_label is null or v_label = '' then
      v_label := 'Người dùng đã chọn';
    end if;
    if char_length(v_label) > 180 then
      v_label := left(v_label, 177) || '...';
    end if;
  else
    v_label := 'Tất cả';
  end if;

  if v_recurrence = 'weekly' then
    v_weekday := nullif(p_payload->>'weekday', '')::smallint;
    if v_weekday is null or v_weekday < 1 or v_weekday > 7 then
      raise exception 'Chọn thứ trong tuần để lặp lại.';
    end if;
  end if;

  if v_recurrence = 'monthly' then
    v_month_day := nullif(p_payload->>'month_day', '')::smallint;
    if v_month_day is null or v_month_day < 1 or v_month_day > 31 then
      raise exception 'Ngày trong tháng phải từ 1 đến 31.';
    end if;
  end if;

  if v_mode = 'now' then
    v_scheduled := now();
  else
    begin
      v_scheduled := nullif(p_payload->>'scheduled_at', '')::timestamptz;
    exception when others then
      raise exception 'Ngày hoặc giờ không hợp lệ.';
    end;
    if v_scheduled is null then
      raise exception 'Chọn ngày và giờ gửi.';
    end if;
    if v_scheduled <= now() then
      raise exception 'Giờ hẹn phải ở tương lai.';
    end if;
  end if;

  v_send_time := (v_scheduled at time zone 'Asia/Ho_Chi_Minh')::time;
  v_status := case when v_mode = 'now' then 'pending' else 'scheduled' end;
  v_id := nullif(p_payload->>'id', '')::uuid;

  if v_id is not null then
    select * into v_existing from public.admin_notifications where id = v_id;
    if v_existing.id is null then
      raise exception 'Không tìm thấy chiến dịch để sửa.';
    end if;

    update public.admin_notifications
    set
      title = v_title,
      body = v_body,
      image_url = v_image,
      action_url = v_url,
      audience = v_audience,
      targets = v_targets,
      target_label = v_label,
      send_mode = v_mode,
      scheduled_at = v_scheduled,
      send_time = v_send_time,
      recurrence = v_recurrence,
      weekday = v_weekday,
      month_day = v_month_day,
      status = v_status,
      next_run_at = v_scheduled,
      last_error = null,
      updated_at = now()
    where id = v_id
    returning * into v_row;
  else
    insert into public.admin_notifications (
      title, body, image_url, action_url, audience, targets, target_label,
      send_mode, scheduled_at, send_time, recurrence, weekday, month_day,
      status, next_run_at, created_by
    ) values (
      v_title, v_body, v_image, v_url, v_audience, v_targets, v_label,
      v_mode, v_scheduled, v_send_time, v_recurrence, v_weekday, v_month_day,
      v_status, v_scheduled, auth.uid()
    )
    returning * into v_row;
  end if;

  if v_row.next_run_at is not null and v_row.next_run_at <= clock_timestamp() then
    perform public.run_admin_notification(v_row.id);
    select * into v_row from public.admin_notifications where id = v_row.id;
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_delete_notification_campaign(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_admin() then
    raise exception 'Không có quyền quản trị';
  end if;
  delete from public.admin_notifications where id = p_id;
  if not found then
    raise exception 'Không tìm thấy chiến dịch.';
  end if;
end;
$$;

create or replace function public.process_due_admin_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_total integer := 0;
begin
  if auth.uid() is not null and not public.is_current_admin() then
    raise exception 'Không có quyền quản trị';
  end if;

  for v_id in
    select id
    from public.admin_notifications
    where status in ('pending', 'scheduled')
      and next_run_at is not null
      and next_run_at <= now()
    order by next_run_at
    limit 20
    for update skip locked
  loop
    perform public.run_admin_notification(v_id);
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.admin_notification_next_run(timestamptz, time, text, smallint, smallint, timestamptz) from public, anon, authenticated;
revoke all on function public.run_admin_notification(uuid) from public, anon, authenticated;
revoke all on function public.admin_save_notification_campaign(jsonb) from public, anon;
revoke all on function public.admin_delete_notification_campaign(uuid) from public, anon;
revoke all on function public.process_due_admin_notifications() from public, anon;

grant execute on function public.admin_save_notification_campaign(jsonb) to authenticated;
grant execute on function public.admin_delete_notification_campaign(uuid) to authenticated;
grant execute on function public.process_due_admin_notifications() to authenticated;

-- Ảnh banner công khai để điện thoại tải được khi hiện thông báo.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'notification-images',
    'notification-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
  on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "notification_images_read" on storage.objects;
  create policy "notification_images_read" on storage.objects
    for select to public
    using (bucket_id = 'notification-images');

  drop policy if exists "notification_images_admin_insert" on storage.objects;
  create policy "notification_images_admin_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'notification-images' and public.is_current_admin());
exception when others then
  raise notice 'Bỏ qua kho ảnh thông báo: %', sqlerrm;
end $$;

-- Gắn ảnh banner vào payload Expo nếu chiến dịch có hình.
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
  v_image text;
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

  v_image := nullif(trim(coalesce(v_row.data->>'image', '')), '');
  if v_image ~* '^https://' then
    v_payload := v_payload || jsonb_build_object(
      'mutableContent', true,
      'richContent', jsonb_build_object('image', v_image)
    );
  end if;

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

revoke all on function public.dispatch_push_outbox_row(uuid) from public, anon, authenticated;

do $$
declare
  v_job bigint;
begin
  create extension if not exists pg_cron;
  select jobid into v_job from cron.job where jobname = 'process-admin-notifications';
  if v_job is not null then
    perform cron.unschedule(v_job);
  end if;
  perform cron.schedule(
    'process-admin-notifications',
    '* * * * *',
    'select public.process_due_admin_notifications()'
  );
exception when others then
  raise notice 'Chưa bật pg_cron, chiến dịch đến giờ sẽ gửi khi mở màn quản trị: %', sqlerrm;
end $$;
