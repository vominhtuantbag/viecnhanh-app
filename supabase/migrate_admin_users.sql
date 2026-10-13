-- Cho phép quản trị khoá tài khoản từ trang Người dùng.
alter table public.profiles add column if not exists is_banned boolean not null default false;
