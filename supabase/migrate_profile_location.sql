-- Khu vực mặc định trên hồ sơ. Chạy một lần trong Supabase → SQL Editor.
alter table public.profiles add column if not exists province_id text;
alter table public.profiles add column if not exists ward_id text;
