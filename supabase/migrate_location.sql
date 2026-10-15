-- Vị trí người dùng và vị trí tin đăng, để tính khoảng cách.
-- Dán vào Supabase Dashboard → SQL Editor → Run.
-- Không xóa người dùng hay tin đăng.

alter table public.profiles add column if not exists latitude double precision;
alter table public.profiles add column if not exists longitude double precision;
alter table public.profiles add column if not exists location_updated_at timestamptz;

alter table public.jobs add column if not exists latitude double precision;
alter table public.jobs add column if not exists longitude double precision;

create index if not exists profiles_location_idx
  on public.profiles (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists jobs_location_idx
  on public.jobs (latitude, longitude)
  where latitude is not null and longitude is not null;
