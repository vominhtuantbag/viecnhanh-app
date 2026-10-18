-- 45 thành tựu dài hạn. Chạy một lần trong Supabase → SQL Editor.

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null default '',
  category text not null check (category in ('worker', 'host', 'general')),
  action_type text not null,
  target_count integer not null default 1 check (target_count > 0),
  reward_coins integer not null default 0 check (reward_coins >= 0),
  badge_name text not null default '',
  icon_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "achievements_select" on public.achievements;
drop policy if exists "achievements_admin_write" on public.achievements;
drop policy if exists "user_achievements_select" on public.user_achievements;
drop policy if exists "user_achievements_insert" on public.user_achievements;

create policy "achievements_select" on public.achievements
  for select using (is_active = true or public.is_current_admin());
create policy "achievements_admin_write" on public.achievements
  for all using (public.is_current_admin()) with check (public.is_current_admin());

create policy "user_achievements_select" on public.user_achievements
  for select using (auth.uid() = user_id or public.is_current_admin());
create policy "user_achievements_insert" on public.user_achievements
  for insert with check (auth.uid() = user_id);

grant select on public.achievements to anon, authenticated;
grant select, insert, update, delete on public.achievements to authenticated;
grant select, insert on public.user_achievements to authenticated;

insert into public.achievements (id, title, description, category, action_type, target_count, reward_coins, badge_name, icon_url)
values
  ('worker-done-1', 'Việc đầu tay', 'Hoàn thành 1 công việc với vai trò thợ.', 'worker', 'worker_completed', 1, 20, 'Tân thợ', 'hammer-outline'),
  ('worker-done-5', 'Thợ quen việc', 'Hoàn thành 5 công việc.', 'worker', 'worker_completed', 5, 40, 'Thợ quen tay', 'hammer-outline'),
  ('worker-done-10', 'Tay nghề vững', 'Hoàn thành 10 công việc.', 'worker', 'worker_completed', 10, 60, 'Thợ vững', 'construct-outline'),
  ('worker-done-25', 'Thợ lành nghề', 'Hoàn thành 25 công việc.', 'worker', 'worker_completed', 25, 100, 'Lành nghề', 'ribbon-outline'),
  ('worker-done-50', 'Thợ kỳ cựu', 'Hoàn thành 50 công việc.', 'worker', 'worker_completed', 50, 200, 'Kỳ cựu', 'trophy-outline'),
  ('worker-done-100', 'Trăm việc', 'Hoàn thành 100 công việc.', 'worker', 'worker_completed', 100, 400, 'Bậc thầy', 'trophy-outline'),
  ('worker-done-200', 'Hai trăm việc', 'Hoàn thành 200 công việc.', 'worker', 'worker_completed', 200, 800, 'Huyền thoại thợ', 'medal-outline'),
  ('worker-bid-1', 'Đề xuất đầu tiên', 'Gửi đề xuất cho 1 tin đăng.', 'worker', 'worker_bids', 1, 15, 'Bắt nhịp', 'paper-plane-outline'),
  ('worker-bid-10', 'Chăm báo giá', 'Gửi 10 đề xuất.', 'worker', 'worker_bids', 10, 40, 'Nhanh tay', 'paper-plane-outline'),
  ('worker-bid-50', 'Săn việc', 'Gửi 50 đề xuất.', 'worker', 'worker_bids', 50, 100, 'Săn việc', 'flash-outline'),
  ('worker-star-1', 'Sao đầu tiên', 'Nhận 1 đánh giá 5 sao.', 'worker', 'worker_stars', 1, 20, 'Được khen', 'star-outline'),
  ('worker-star-5', 'Được tin', 'Nhận 5 đánh giá 5 sao.', 'worker', 'worker_stars', 5, 50, 'Đáng tin', 'star-outline'),
  ('worker-star-20', 'Sao đều tay', 'Nhận 20 đánh giá 5 sao.', 'worker', 'worker_stars', 20, 150, 'Sao đều', 'star'),
  ('worker-star-50', 'Ngôi sao thợ', 'Nhận 50 đánh giá 5 sao.', 'worker', 'worker_stars', 50, 300, 'Ngôi sao', 'star'),
  ('worker-hire-10', 'Được chọn mười lần', 'Được chủ nhà thuê 10 lần.', 'worker', 'worker_assigned', 10, 80, 'Được chọn', 'checkmark-circle-outline'),
  ('host-post-1', 'Tin đầu tiên', 'Đăng 1 tin việc.', 'host', 'host_posted', 1, 20, 'Chủ nhà mới', 'home-outline'),
  ('host-post-5', 'Năm tin', 'Đăng 5 tin việc.', 'host', 'host_posted', 5, 40, 'Hay đăng', 'home-outline'),
  ('host-post-10', 'Mười tin', 'Đăng 10 tin việc.', 'host', 'host_posted', 10, 60, 'Chủ nhà chăm', 'briefcase-outline'),
  ('host-post-25', 'Hai mươi lăm tin', 'Đăng 25 tin việc.', 'host', 'host_posted', 25, 120, 'Đăng đều', 'briefcase-outline'),
  ('host-post-50', 'Năm mươi tin', 'Đăng 50 tin việc.', 'host', 'host_posted', 50, 250, 'Chủ nhà lớn', 'business-outline'),
  ('host-post-100', 'Trăm tin', 'Đăng 100 tin việc.', 'host', 'host_posted', 100, 500, 'Đối tác', 'business-outline'),
  ('host-hire-1', 'Thuê lần đầu', 'Thuê thợ cho 1 tin.', 'host', 'host_hired', 1, 20, 'Biết chọn', 'people-outline'),
  ('host-hire-10', 'Thuê mười lần', 'Thuê thợ 10 lần.', 'host', 'host_hired', 10, 80, 'Hay thuê', 'people-outline'),
  ('host-hire-25', 'Thuê hai mươi lăm lần', 'Thuê thợ 25 lần.', 'host', 'host_hired', 25, 180, 'Tin người', 'people'),
  ('host-done-1', 'Xong việc đầu', 'Có 1 tin của bạn được hoàn thành.', 'host', 'host_completed', 1, 30, 'Khép lại', 'checkbox-outline'),
  ('host-done-10', 'Mười việc xong', 'Hoàn thành 10 tin bạn đã đăng.', 'host', 'host_completed', 10, 100, 'Gọn việc', 'checkbox-outline'),
  ('host-done-25', 'Hai mươi lăm việc xong', 'Hoàn thành 25 tin bạn đã đăng.', 'host', 'host_completed', 25, 200, 'Chủ nhà chắc', 'shield-checkmark-outline'),
  ('host-review-1', 'Lời khen đầu', 'Viết 1 đánh giá cho thợ.', 'host', 'host_reviews', 1, 15, 'Biết ơn', 'chatbox-outline'),
  ('host-review-10', 'Mười lời nhận xét', 'Viết 10 đánh giá.', 'host', 'host_reviews', 10, 60, 'Công tâm', 'chatbox-outline'),
  ('host-review-25', 'Hai mươi lăm nhận xét', 'Viết 25 đánh giá.', 'host', 'host_reviews', 25, 120, 'Người góp ý', 'chatbubbles-outline'),
  ('general-streak-3', 'Ba ngày liên tiếp', 'Điểm danh 3 ngày liên tiếp.', 'general', 'checkin_streak', 3, 15, 'Bắt đầu đều', 'calendar-outline'),
  ('general-streak-7', 'Một tuần đều đặn', 'Giữ chuỗi điểm danh 7 ngày.', 'general', 'checkin_streak', 7, 40, 'Chuỗi tuần', 'calendar-outline'),
  ('general-streak-30', 'Một tháng kiên trì', 'Giữ chuỗi điểm danh 30 ngày.', 'general', 'checkin_streak', 30, 150, 'Kiên trì', 'calendar'),
  ('general-streak-100', 'Trăm ngày', 'Giữ chuỗi điểm danh 100 ngày.', 'general', 'checkin_streak', 100, 400, 'Không bỏ', 'flame-outline'),
  ('general-refer-1', 'Người bạn đầu tiên', 'Có 1 người dùng mã giới thiệu của bạn.', 'general', 'referrals', 1, 50, 'Người mở đường', 'person-add-outline'),
  ('general-refer-5', 'Nhóm năm bạn', 'Mời được 5 người.', 'general', 'referrals', 5, 150, 'Kết nối', 'people-outline'),
  ('general-refer-10', 'Mười người cùng dùng', 'Mời được 10 người.', 'general', 'referrals', 10, 300, 'Lan tỏa', 'share-social-outline'),
  ('general-profile', 'Hồ sơ đủ thông tin', 'Có họ tên và số điện thoại trên hồ sơ.', 'general', 'profile_ready', 1, 20, 'Rõ ràng', 'person-circle-outline'),
  ('general-points-100', 'Gom 100 xu', 'Đạt 100 xu trong ví thưởng.', 'general', 'points', 100, 20, 'Có của', 'cash-outline'),
  ('general-points-500', 'Gom 500 xu', 'Đạt 500 xu trong ví thưởng.', 'general', 'points', 500, 40, 'Khá giả', 'cash-outline'),
  ('general-points-1000', 'Gom 1000 xu', 'Đạt 1000 xu trong ví thưởng.', 'general', 'points', 1000, 80, 'Giàu xu', 'wallet-outline'),
  ('general-view-10', 'Xem mười tin', 'Mở xem 10 tin việc khác nhau.', 'general', 'views', 10, 15, 'Tò mò', 'eye-outline'),
  ('general-view-50', 'Xem năm mươi tin', 'Mở xem 50 tin việc khác nhau.', 'general', 'views', 50, 40, 'Nhiều chuyện', 'eye-outline'),
  ('general-chat-5', 'Năm tin nhắn', 'Gửi 5 tin nhắn.', 'general', 'messages', 5, 15, 'Bắt chuyện', 'chatbubble-outline'),
  ('general-chat-20', 'Hai mươi tin nhắn', 'Gửi 20 tin nhắn.', 'general', 'messages', 20, 40, 'Nói chuyện', 'chatbubbles-outline')
on conflict (id) do nothing;
