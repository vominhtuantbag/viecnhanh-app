-- Một tài khoản chỉ đăng nhập một thiết bị.
-- Chạy một lần trong Supabase → SQL Editor. Không xóa dữ liệu.

alter table public.profiles add column if not exists current_device_id text;

alter table public.profiles replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
end $$;
