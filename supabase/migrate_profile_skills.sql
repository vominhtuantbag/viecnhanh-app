-- Thêm danh sách kỹ năng vào hồ sơ. Dán vào Supabase SQL Editor → Run.
alter table public.profiles add column if not exists skill_ids text[] not null default '{}';
