-- Vòng đời việc: hủy thuê → mở lại chọn thợ khác; thanh toán + đánh giá → hoàn thành.
-- Chạy trên DB đang có dữ liệu. Fresh install: schema.sql đã gồm các thay đổi này.

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
  check (status in ('pending', 'approved', 'assigned', 'completed', 'closed'));

alter table public.bids drop constraint if exists bids_status_check;
alter table public.bids
  add constraint bids_status_check
  check (status in ('pending', 'accepted', 'rejected', 'cancelled'));

alter table public.jobs add column if not exists completed_at timestamptz;
alter table public.jobs add column if not exists hire_cancel_reason text;
alter table public.bids add column if not exists cancel_reason text;

update public.jobs
set status = 'assigned'
where hired_worker_id is not null
  and status = 'approved';

create unique index if not exists reviews_job_reviewer_unique
  on public.reviews (job_id, reviewer_id)
  where job_id is not null;

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

create or replace function public.refresh_worker_stats(p_worker_id uuid)
returns void
language plpgsql
as $$
begin
  if p_worker_id is null then
    return;
  end if;

  update public.profiles
  set
    reviews_count = (select count(*) from public.reviews r where r.worker_id = p_worker_id),
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.worker_id = p_worker_id), 0),
    completed_jobs = (
      select count(*) from public.jobs j
      where j.hired_worker_id = p_worker_id and j.status = 'completed'
    )
  where id = p_worker_id;
end;
$$;

create or replace function public.refresh_worker_stats_from_job()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_worker_stats(coalesce(new.hired_worker_id, old.hired_worker_id));
  if tg_op = 'update' and old.hired_worker_id is distinct from new.hired_worker_id then
    perform public.refresh_worker_stats(old.hired_worker_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists jobs_refresh_worker_stats on public.jobs;
create trigger jobs_refresh_worker_stats
  after insert or update or delete on public.jobs
  for each row execute function public.refresh_worker_stats_from_job();

create or replace function public.submit_bid(
  p_job_id uuid,
  p_proposed_price numeric,
  p_message text default ''
)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_bid public.bids;
  v_fee numeric := 3000;
  v_balance numeric;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để gửi đề xuất.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.user_id = v_user then
    raise exception 'Bạn không thể báo giá tin của chính mình.';
  end if;

  if v_job.status <> 'approved'
     or coalesce(v_job.is_approved, false) = false
     or v_job.hired_worker_id is not null then
    raise exception 'Tin đăng chưa nhận đề xuất.';
  end if;

  select * into v_bid
  from public.bids
  where job_id = p_job_id and worker_id = v_user;

  if v_bid.id is not null then
    raise exception 'BID_EXISTS';
  end if;

  select wallet_balance into v_balance
  from public.profiles
  where id = v_user
  for update;

  if coalesce(v_balance, 0) < v_fee then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles
  set wallet_balance = wallet_balance - v_fee
  where id = v_user;

  insert into public.bids (job_id, worker_id, proposed_price, message, status)
  values (
    p_job_id,
    v_user,
    coalesce(p_proposed_price, 0),
    coalesce(trim(p_message), ''),
    'pending'
  )
  returning * into v_bid;

  return v_bid;
end;
$$;

create or replace function public.hire_worker(p_bid_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_bid public.bids;
  v_job public.jobs;
  v_conv public.conversations;
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để thuê thợ.';
  end if;

  select * into v_bid from public.bids where id = p_bid_id;
  if v_bid.id is null then
    raise exception 'Không tìm thấy đề xuất.';
  end if;

  select * into v_job from public.jobs where id = v_bid.job_id;
  if v_job.user_id <> v_user then
    raise exception 'Chỉ người đăng tin mới xác nhận thuê thợ.';
  end if;

  if v_job.status = 'completed' then
    raise exception 'Công việc đã hoàn thành.';
  end if;

  if v_job.hired_worker_id is not null or v_job.status = 'assigned' then
    raise exception 'Tin đăng này đã thuê thợ.';
  end if;

  if v_job.status <> 'approved' then
    raise exception 'Tin đăng chưa thể thuê thợ.';
  end if;

  update public.bids
  set status = case when id = p_bid_id then 'accepted' else 'rejected' end,
      cancel_reason = null
  where job_id = v_job.id
    and status <> 'cancelled';

  update public.bids
  set status = 'accepted',
      cancel_reason = null
  where id = p_bid_id;

  update public.jobs
  set hired_worker_id = v_bid.worker_id,
      hired_bid_id = v_bid.id,
      status = 'assigned',
      hire_cancel_reason = null,
      completed_at = null
  where id = v_job.id
  returning * into v_job;

  select * into v_conv
  from public.conversations
  where job_id = v_job.id and worker_id = v_bid.worker_id;

  if v_conv.id is not null then
    insert into public.messages (conversation_id, sender_id, body, kind)
    values (
      v_conv.id,
      v_user,
      'Người đăng tin đã xác nhận thuê bạn thực hiện công việc này.',
      'system'
    );
  end if;

  return v_job;
end;
$$;

create or replace function public.cancel_hire(p_job_id uuid, p_reason text)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_bid public.bids;
  v_conv public.conversations;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để hủy thuê thợ.';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Không tìm thấy tin đăng.';
  end if;

  if v_job.user_id <> v_user then
    raise exception 'Chỉ người đăng tin mới hủy thuê thợ.';
  end if;

  if v_job.status = 'completed' then
    raise exception 'Công việc đã hoàn thành, không thể hủy thuê.';
  end if;

  if v_job.hired_worker_id is null and v_job.status <> 'assigned' then
    raise exception 'Tin đăng chưa thuê thợ.';
  end if;

  if v_reason is null then
    raise exception 'Vui lòng chọn lý do hủy thuê.';
  end if;

  if v_job.hired_bid_id is not null then
    select * into v_bid from public.bids where id = v_job.hired_bid_id;
  end if;

  if v_bid.id is null and v_job.hired_worker_id is not null then
    select * into v_bid
    from public.bids
    where job_id = v_job.id
      and worker_id = v_job.hired_worker_id
    order by created_at desc
    limit 1;
  end if;

  if v_bid.id is not null then
    update public.bids
    set status = 'cancelled',
        cancel_reason = v_reason
    where id = v_bid.id;
  end if;

  update public.bids
  set status = 'pending'
  where job_id = v_job.id
    and status = 'rejected';

  update public.jobs
  set hired_worker_id = null,
      hired_bid_id = null,
      status = 'approved',
      hire_cancel_reason = v_reason,
      completed_at = null
  where id = v_job.id
  returning * into v_job;

  if v_bid.worker_id is not null then
    select * into v_conv
    from public.conversations
    where job_id = v_job.id and worker_id = v_bid.worker_id;

    if v_conv.id is not null then
      insert into public.messages (conversation_id, sender_id, body, kind)
      values (
        v_conv.id,
        v_user,
        'Người đăng tin đã hủy thuê. Lý do: ' || v_reason,
        'system'
      );
    end if;
  end if;

  return v_job;
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
  v_rating numeric;
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

  v_rating := p_rating;
  if v_rating is not null and (v_rating < 1 or v_rating > 5) then
    raise exception 'Điểm đánh giá phải từ 1 đến 5.';
  end if;

  if v_rating is not null then
    insert into public.reviews (job_id, worker_id, reviewer_id, rating, comment, role)
    select
      v_job.id,
      v_job.hired_worker_id,
      v_user,
      v_rating,
      coalesce(trim(p_comment), ''),
      'worker'
    where not exists (
      select 1 from public.reviews r
      where r.job_id = v_job.id and r.reviewer_id = v_user
    );
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

grant execute on function public.cancel_hire(uuid, text) to authenticated;
grant execute on function public.complete_job(uuid, numeric, text) to authenticated;
grant execute on function public.refresh_worker_stats(uuid) to anon, authenticated;
