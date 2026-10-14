-- Banner trang chủ và icon danh mục chính.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Không xóa người dùng, tin đăng hay danh mục đã chỉnh trên máy.

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  link text,
  status text not null default 'show'
    check (status in ('show', 'hide', 'hien', 'an')),
  is_active boolean generated always as (status in ('show', 'hien')) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.danh_muc_chinh (
  id text primary key,
  name text not null,
  icon text,
  icon_url text,
  status text not null default 'show'
    check (status in ('show', 'hide', 'hien', 'an')),
  is_active boolean generated always as (status in ('show', 'hien')) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists banners_active_idx on public.banners (sort_order, created_at desc);
create index if not exists danh_muc_chinh_active_idx on public.danh_muc_chinh (sort_order, name);

alter table public.banners enable row level security;
alter table public.danh_muc_chinh enable row level security;

drop policy if exists "banners_read" on public.banners;
drop policy if exists "banners_admin_write" on public.banners;
drop policy if exists "danh_muc_chinh_read" on public.danh_muc_chinh;
drop policy if exists "danh_muc_chinh_admin_write" on public.danh_muc_chinh;

create policy "banners_read" on public.banners
  for select to anon, authenticated
  using (is_active or public.is_current_admin());

create policy "banners_admin_write" on public.banners
  for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "danh_muc_chinh_read" on public.danh_muc_chinh
  for select to anon, authenticated
  using (is_active or public.is_current_admin());

create policy "danh_muc_chinh_admin_write" on public.danh_muc_chinh
  for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

grant select on public.banners to anon, authenticated;
grant select on public.danh_muc_chinh to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;
grant insert, update, delete on public.danh_muc_chinh to authenticated;

insert into public.banners (title, image_url, link, status, sort_order)
select *
from (
  values
    (
      'Việc nhà cuối tuần',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
      '/create',
      'show',
      1
    ),
    (
      'Thợ gần bạn, báo giá nhanh',
      'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80',
      '/browse',
      'show',
      2
    ),
    (
      'Đổi quà sau khi xong việc',
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80',
      '/rewards',
      'show',
      3
    )
) as seed(title, image_url, link, status, sort_order)
where not exists (select 1 from public.banners);

insert into public.danh_muc_chinh (id, name, icon, sort_order)
values
  ('gardening', 'Làm vườn', 'leaf-outline', 1),
  ('painting', 'Sơn nhà', 'color-palette-outline', 2),
  ('cleaning', 'Dọn dẹp', 'sparkles-outline', 3),
  ('handyman', 'Sửa chữa nhà cửa', 'construct-outline', 4),
  ('delivery', 'Giao hàng', 'bicycle-outline', 5),
  ('assembly', 'Lắp ráp nội thất', 'cube-outline', 6),
  ('soundproofing', 'Cách âm', 'volume-mute-outline', 7),
  ('advisory', 'Tư vấn', 'chatbubbles-outline', 8),
  ('beauty', 'Dịch vụ làm đẹp', 'flower-outline', 9),
  ('moving', 'Chuyển nhà', 'car-outline', 10),
  ('tutoring', 'Gia sư', 'school-outline', 11),
  ('it', 'Công nghệ & máy tính', 'laptop-outline', 12),
  ('photography', 'Nhiếp ảnh', 'camera-outline', 13),
  ('pet', 'Chăm sóc thú cưng', 'paw-outline', 14),
  ('electrical', 'Điện nước', 'flash-outline', 15)
on conflict (id) do nothing;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    (
      'category-icons',
      'category-icons',
      true,
      2097152,
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    ),
    (
      'banner-images',
      'banner-images',
      true,
      5242880,
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    )
  on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "category_icons_read" on storage.objects;
  create policy "category_icons_read" on storage.objects
    for select to public
    using (bucket_id = 'category-icons');

  drop policy if exists "category_icons_admin_insert" on storage.objects;
  create policy "category_icons_admin_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'category-icons' and public.is_current_admin());

  drop policy if exists "banner_images_read" on storage.objects;
  create policy "banner_images_read" on storage.objects
    for select to public
    using (bucket_id = 'banner-images');

  drop policy if exists "banner_images_admin_insert" on storage.objects;
  create policy "banner_images_admin_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'banner-images' and public.is_current_admin());
exception when others then
  raise notice 'Bỏ qua kho ảnh banner/icon: %', sqlerrm;
end $$;
