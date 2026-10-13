-- Chat inbox + đánh giá sau thanh toán. Dán vào Supabase SQL Editor → Run.
-- Không xóa dữ liệu hiện có.

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

create unique index if not exists reviews_job_reviewer_unique
  on public.reviews (job_id, reviewer_id)
  where job_id is not null;

create or replace function public.fetch_my_conversations()
returns setof public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  return query
    select *
    from public.conversations c
    where c.poster_id = v_user or c.worker_id = v_user
    order by c.created_at desc;
end;
$$;

create or replace function public.complete_job(
  p_job_id uuid,
  p_rating numeric default null,
  p_comment text default ''
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_conv public.conversations;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để hoàn tất công việc.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.user_id <> v_user then
    raise exception 'Chỉ người đăng tin mới thanh toán và hoàn tất.';
  end if;

  if v_job.status = 'completed' then
    return v_job;
  end if;

  if v_job.hired_worker_id is null then
    raise exception 'Chưa thuê thợ nên không thể hoàn tất.';
  end if;

  update public.jobs
  set status = 'completed',
      completed_at = coalesce(completed_at, now())
  where id = v_job.id
  returning * into v_job;

  select * into v_conv
  from public.conversations
  where job_id = v_job.id and worker_id = v_job.hired_worker_id;

  if v_conv.id is not null then
    insert into public.messages (conversation_id, sender_id, body, kind)
    values (
      v_conv.id,
      v_user,
      'Người đăng tin đã thanh toán và hoàn tất công việc.',
      'system'
    );
  end if;

  return v_job;
end;
$$;

create or replace function public.submit_job_review(
  p_job_id uuid,
  p_rating numeric,
  p_comment text default ''
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_subject uuid;
  v_role text;
  v_row public.reviews;
  v_exists boolean;
  v_has_role boolean;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để đánh giá.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Điểm đánh giá phải từ 1 đến 5.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.status <> 'completed' then
    raise exception 'Chỉ đánh giá sau khi công việc đã thanh toán.';
  end if;

  if v_user = v_job.user_id then
    v_subject := v_job.hired_worker_id;
    v_role := 'worker';
  elsif v_user = v_job.hired_worker_id then
    v_subject := v_job.user_id;
    v_role := 'poster';
  else
    raise exception 'Bạn không thuộc công việc này.';
  end if;

  if v_subject is null then
    raise exception 'Không xác định được người được đánh giá.';
  end if;

  select exists (
    select 1 from public.reviews r
    where r.job_id = v_job.id and r.reviewer_id = v_user
  ) into v_exists;

  if v_exists then
    select * into v_row
    from public.reviews
    where job_id = v_job.id and reviewer_id = v_user
    limit 1;
    return v_row;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviews' and column_name = 'role'
  ) into v_has_role;

  if v_has_role then
    insert into public.reviews (job_id, worker_id, reviewer_id, rating, comment, role)
    values (v_job.id, v_subject, v_user, p_rating, coalesce(trim(p_comment), ''), v_role)
    returning * into v_row;
  else
    insert into public.reviews (job_id, worker_id, reviewer_id, rating, comment)
    values (v_job.id, v_subject, v_user, p_rating, coalesce(trim(p_comment), ''))
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.fetch_my_conversations() to authenticated;
grant execute on function public.complete_job(uuid, numeric, text) to authenticated;
grant execute on function public.submit_job_review(uuid, numeric, text) to authenticated;
