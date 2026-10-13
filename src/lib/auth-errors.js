const RULES = [
  ['invalid login credentials', 'Số điện thoại hoặc mật khẩu chưa đúng.'],
  ['invalid credentials', 'Số điện thoại hoặc mật khẩu chưa đúng.'],
  ['user already registered', 'Số điện thoại này đã được đăng ký. Hãy đăng nhập.'],
  ['already registered', 'Tài khoản này đã tồn tại. Hãy đăng nhập.'],
  ['email not confirmed', 'Tài khoản chưa được xác nhận. Tắt "Confirm email" trong Supabase Auth (Email provider).'],
  ['password should be at least', 'Mật khẩu cần ít nhất 6 ký tự.'],
  ['signup is disabled', 'Đăng ký đang bị tắt trên Supabase Auth.'],
  ['provider is not enabled', 'Nhà cung cấp đăng nhập này chưa được bật trên Supabase.'],
  ['unsupported provider', 'Nhà cung cấp đăng nhập này chưa được bật trên Supabase.'],
  ['validation_failed', 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'],
  ['rate limit', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau giây lát.'],
  ['network request failed', 'Không kết nối được mạng. Kiểm tra internet rồi thử lại.'],
  ['failed to fetch', 'Không kết nối được máy chủ. Vui lòng thử lại.'],
  ['user cancelled', 'Bạn đã hủy đăng nhập.'],
  ['canceled', 'Bạn đã hủy đăng nhập.'],
  ['err_request_canceled', 'Bạn đã hủy đăng nhập.'],
  ['no identity token', 'Apple không trả về mã xác thực. Thử lại trên thiết bị thật.'],
  ['duplicate key', 'Số điện thoại này đã gắn với tài khoản khác.'],
];

export function toAuthErrorMessage(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  const matched = RULES.find(([needle]) => raw.includes(needle));
  if (matched) return matched[1];
  if (!raw) return 'Có lỗi xảy ra. Vui lòng thử lại.';
  return error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
}
