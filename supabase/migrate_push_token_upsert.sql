-- Sửa lỗi duplicate key device_push_tokens_token_key.
-- Dán vào Supabase Dashboard → SQL Editor → Run.

create or replace function public.upsert_device_push_token(
  p_token text,
  p_platform text default 'unknown'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_platform text := coalesce(nullif(trim(p_platform), ''), 'unknown');
begin
  if v_user is null then
    raise exception 'Cần đăng nhập để lưu push token.';
  end if;
  if p_token is null or p_token not like 'ExponentPushToken[%' then
    raise exception 'Expo Push Token không hợp lệ.';
  end if;

  -- security definer: cập nhật được cả dòng token cũ (kể cả user khác / RLS).
  update public.device_push_tokens
  set user_id = v_user,
      platform = v_platform,
      updated_at = now()
  where token = p_token;

  if found then
    return;
  end if;

  begin
    insert into public.device_push_tokens (user_id, token, platform, updated_at)
    values (v_user, p_token, v_platform, now());
  exception when unique_violation then
    update public.device_push_tokens
    set user_id = v_user,
        platform = v_platform,
        updated_at = now()
    where token = p_token;
  end;
end;
$$;

revoke all on function public.upsert_device_push_token(text, text) from public, anon;
grant execute on function public.upsert_device_push_token(text, text) to authenticated;
