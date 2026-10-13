-- Tin hiện hành chỉ là Đang mở (approved). Đã nhận / Hoàn thành / Chờ duyệt không chặn tin mới.

create or replace function public.apply_job_moderation()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count
  from public.jobs
  where user_id = new.user_id
    and status = 'approved';

  if existing_count = 0 then
    new.is_approved := true;
    new.status := 'approved';
  else
    new.is_approved := false;
    new.status := 'pending';
  end if;

  return new;
end;
$$;
