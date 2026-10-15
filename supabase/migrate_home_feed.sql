-- Mẫu câu chạy trên trang chủ + hộp thông báo của từng người.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Không xóa người dùng, tin đăng hay thông báo cũ.

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  status text not null default 'on'
    check (status in ('on', 'off', 'show', 'hide')),
  is_active boolean generated always as (status in ('on', 'show')) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  push_group text,
  kind text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_templates_active_idx
  on public.notification_templates (sort_order, created_at);
create index if not exists user_notifications_user_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.notification_templates enable row level security;
alter table public.user_notifications enable row level security;

drop policy if exists "notification_templates_read" on public.notification_templates;
drop policy if exists "notification_templates_admin_write" on public.notification_templates;
drop policy if exists "user_notifications_own_read" on public.user_notifications;
drop policy if exists "user_notifications_own_update" on public.user_notifications;

create policy "notification_templates_read" on public.notification_templates
  for select to anon, authenticated
  using (is_active or public.is_current_admin());

create policy "notification_templates_admin_write" on public.notification_templates
  for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "user_notifications_own_read" on public.user_notifications
  for select to authenticated
  using (auth.uid() = user_id);

create policy "user_notifications_own_update" on public.user_notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.notification_templates to anon, authenticated;
grant insert, update, delete on public.notification_templates to authenticated;
grant select, update on public.user_notifications to authenticated;

insert into public.notification_templates (name, body, status, sort_order)
select *
from (
  values
    ('Mẹo vặt', 'Nhanh tay gửi báo giá để được xem trước.', 'on', 1),
    ('Mẹo vặt', 'Làm nhiệm vụ hệ thống để nhận quà', 'on', 2),
    ('Thông báo', 'Không chuyển tiền trước tránh lừa đảo', 'on', 3),
    ('Khuyến mãi', 'Mã giảm giá 10% dùng cho cả tuần nè!', 'on', 4),
    ('Hướng dẫn', 'Cách sử dụng app hiệu quả', 'on', 5)
) as seed(name, body, status, sort_order)
where not exists (select 1 from public.notification_templates);

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
  v_title text;
  v_body text;
  v_data jsonb;
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
  v_title := coalesce(nullif(trim(p_title), ''), 'Việc Nhanh');
  v_body := coalesce(p_body, '');
  v_data := coalesce(p_data, '{}'::jsonb) || jsonb_build_object(
    'group', p_group,
    'kind', p_kind
  );

  begin
    insert into public.user_notifications (
      user_id, title, body, data, push_group, kind
    ) values (
      p_user_id, v_title, v_body, v_data, p_group, p_kind
    );
  exception when others then
    null;
  end;

  insert into public.push_outbox (
    user_id, push_group, kind, title, body, data, channel_id, collapse_id
  ) values (
    p_user_id,
    p_group,
    p_kind,
    v_title,
    v_body,
    v_data,
    v_channel,
    v_collapse
  );
end;
$$;

insert into public.user_notifications (
  user_id, title, body, data, push_group, kind, read_at, created_at
)
select
  o.user_id,
  o.title,
  o.body,
  o.data,
  o.push_group,
  o.kind,
  o.created_at,
  o.created_at
from public.push_outbox o
where not exists (
  select 1
  from public.user_notifications n
  where n.user_id = o.user_id
    and n.title = o.title
    and n.created_at = o.created_at
);

alter table public.user_notifications replica identity full;
alter table public.notification_templates replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.user_notifications;
  exception when others then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.notification_templates;
  exception when others then
    null;
  end;
end $$;
