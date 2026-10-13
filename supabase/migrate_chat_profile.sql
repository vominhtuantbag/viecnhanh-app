-- Nâng cấp chat + hồ sơ công khai. Dán vào Supabase SQL Editor → Run.
-- Không xóa dữ liệu hiện có.

alter table public.profiles add column if not exists id_verified boolean not null default false;
alter table public.reviews add column if not exists role text not null default 'worker';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_role_check'
  ) then
    alter table public.reviews
      add constraint reviews_role_check check (role in ('worker', 'poster'));
  end if;
end $$;

create or replace function public.refresh_worker_stats(p_worker_id uuid)
returns void
language plpgsql
as $$
begin
  update public.profiles
  set
    reviews_count = (select count(*) from public.reviews r where r.worker_id = p_worker_id),
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.worker_id = p_worker_id), 0),
    completed_jobs = (
      select count(*) from public.bids b
      where b.worker_id = p_worker_id and b.status = 'accepted'
    )
  where id = p_worker_id;
end;
$$;

create or replace function public.fetch_chat_messages(p_conversation_id uuid)
returns setof public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ok boolean;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để xem tin nhắn.';
  end if;

  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.poster_id = v_user or c.worker_id = v_user)
  ) into v_ok;

  if not v_ok then
    raise exception 'Bạn không thuộc cuộc trò chuyện này.';
  end if;

  return query
    select *
    from public.messages
    where conversation_id = p_conversation_id
    order by created_at asc;
end;
$$;

grant execute on function public.fetch_chat_messages(uuid) to authenticated;
