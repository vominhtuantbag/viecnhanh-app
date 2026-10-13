-- Chạy trên DB đang chạy (không xóa dữ liệu) để trừ phí ví khi gửi đề xuất.
-- Dán vào Supabase Dashboard → SQL Editor → Run.

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

  if v_job.status <> 'approved' or coalesce(v_job.is_approved, false) = false then
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

grant execute on function public.submit_bid(uuid, numeric, text) to authenticated;
