-- Sửa lỗi: record "new" has no field "id_verified"
-- Dán vào Supabase SQL Editor → Run.
-- Điểm danh cập nhật hồ sơ, hàm gắn trên hồ sơ không được đọc cột chưa có.

alter table public.profiles add column if not exists id_verified boolean not null default false;

create or replace function public.on_profile_reward_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skills integer := 0;
  v_verified boolean := false;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'skill_ids'
  ) then
    execute 'select coalesce(array_length(skill_ids, 1), 0) from public.profiles where id = $1'
      into v_skills using new.id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id_verified'
  ) then
    execute 'select coalesce(id_verified, false) from public.profiles where id = $1'
      into v_verified using new.id;
  end if;

  if coalesce(new.full_name, '') <> ''
     and coalesce(new.phone, '') <> ''
     and (v_verified or v_skills > 0) then
    perform public.bump_reward_progress(new.id, 'complete_profile', 1);
  end if;
  return new;
end;
$$;
