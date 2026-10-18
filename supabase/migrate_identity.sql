-- Ảnh đại diện, giấy tờ xác minh, địa chỉ chi tiết.
-- Chạy một lần trong Supabase → SQL Editor.
-- Cần đã có hàm public.is_current_admin() (file migrate_growth.sql hoặc migrate_rewards.sql).

alter table public.profiles add column if not exists address text;

create table if not exists public.verification_requirements (
  id text primary key,
  title text not null,
  description text not null default '',
  is_enabled boolean not null default true,
  is_required boolean not null default true,
  needs_back boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  requirement_id text not null references public.verification_requirements (id) on delete cascade,
  side text not null check (side in ('front', 'back')),
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, requirement_id, side)
);

alter table public.verification_requirements enable row level security;
alter table public.verification_documents enable row level security;

drop policy if exists "verification_requirements_read" on public.verification_requirements;
drop policy if exists "verification_requirements_admin" on public.verification_requirements;
drop policy if exists "verification_documents_read" on public.verification_documents;
drop policy if exists "verification_documents_insert" on public.verification_documents;
drop policy if exists "verification_documents_update" on public.verification_documents;
drop policy if exists "verification_documents_admin" on public.verification_documents;

create policy "verification_requirements_read" on public.verification_requirements
  for select to authenticated
  using (is_enabled = true or public.is_current_admin());

create policy "verification_requirements_admin" on public.verification_requirements
  for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "verification_documents_read" on public.verification_documents
  for select to authenticated
  using (auth.uid() = user_id or public.is_current_admin());

create policy "verification_documents_insert" on public.verification_documents
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "verification_documents_update" on public.verification_documents
  for update to authenticated
  using (auth.uid() = user_id or public.is_current_admin())
  with check (auth.uid() = user_id or public.is_current_admin());

create policy "verification_documents_admin" on public.verification_documents
  for delete to authenticated
  using (public.is_current_admin());

insert into public.verification_requirements (id, title, description, is_enabled, is_required, needs_back, sort_order)
values
  ('cccd', 'Thẻ Căn cước công dân', 'Ảnh mặt trước và mặt sau căn cước.', true, true, true, 1),
  ('blx', 'Bằng lái xe', 'Ảnh mặt trước và mặt sau bằng lái.', true, true, true, 2)
on conflict (id) do nothing;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    (
      'avatars',
      'avatars',
      true,
      5242880,
      array['image/jpeg', 'image/png', 'image/webp']
    ),
    (
      'verification_docs',
      'verification_docs',
      false,
      8388608,
      array['image/jpeg', 'image/png', 'image/webp']
    )
  on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "avatars_read" on storage.objects;
  create policy "avatars_read" on storage.objects
    for select to public
    using (bucket_id = 'avatars');

  drop policy if exists "avatars_insert" on storage.objects;
  create policy "avatars_insert" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  drop policy if exists "avatars_update" on storage.objects;
  create policy "avatars_update" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  drop policy if exists "verification_docs_read" on storage.objects;
  create policy "verification_docs_read" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'verification_docs'
      and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_current_admin()
      )
    );

  drop policy if exists "verification_docs_insert" on storage.objects;
  create policy "verification_docs_insert" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'verification_docs'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  drop policy if exists "verification_docs_update" on storage.objects;
  create policy "verification_docs_update" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'verification_docs'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when others then
  raise notice 'Bỏ qua kho ảnh: %', sqlerrm;
end $$;
