import { CATEGORIES, getCategoryById } from '@/data/categories';
import { formatArea } from '@/data/locations';

const JOB_STATUS = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đang mở' },
  { value: 'assigned', label: 'Đã nhận' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'closed', label: 'Đã đóng' },
];

const BID_STATUS = [
  { value: 'pending', label: 'Chờ chọn' },
  { value: 'accepted', label: 'Được chọn' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'cancelled', label: 'Đã huỷ' },
];

const ON_OFF = [
  { value: 'on', label: 'Đang bật' },
  { value: 'off', label: 'Đang tắt' },
];

const SHOW_HIDE = [
  { value: 'show', label: 'Đang hiện' },
  { value: 'hide', label: 'Đang ẩn' },
];

const ROLE = [
  { value: 'member', label: 'Thành viên' },
  { value: 'admin', label: 'Quản trị' },
];

const STARS = [5, 4, 3, 2, 1].map((count) => ({ value: String(count), label: `${count} sao` }));
const CATEGORY_OPTIONS = CATEGORIES.map((item) => ({ value: item.id, label: item.name }));

export const ADMIN_MENU = [
  {
    id: 'dashboard',
    label: 'Bảng điều khiển',
    icon: 'home',
    type: 'home',
  },
  {
    id: 'tasks',
    label: 'Quản lý công việc',
    icon: 'clipboard-outline',
    children: [
      {
        id: 'tasks-posts',
        label: 'Tin đăng',
        hint: 'Các tin việc đang có trên hệ thống.',
        board: 'posts',
        live: 'jobs',
        fields: [
          { key: 'title', label: 'Tiêu đề', required: true },
          { key: 'owner', label: 'Người đăng' },
          { key: 'categoryId', label: 'Danh mục', type: 'select', options: CATEGORY_OPTIONS },
          { key: 'location', label: 'Khu vực' },
          { key: 'price', label: 'Ngân sách', type: 'number', money: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: JOB_STATUS },
          { key: 'assignee', label: 'Người nhận' },
        ],
      },
      {
        id: 'tasks-bids',
        label: 'Báo giá',
        hint: 'Các mức giá người làm đang chào.',
        board: 'bids',
        live: 'bids',
        fields: [
          { key: 'task', label: 'Tin đăng', required: true },
          { key: 'tasker', label: 'Người báo giá', required: true },
          { key: 'price', label: 'Số tiền', type: 'number', money: true, required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: BID_STATUS },
          { key: 'note', label: 'Ghi chú' },
        ],
      },
      {
        id: 'tasks-reviews',
        label: 'Đánh giá',
        hint: 'Nhận xét sau khi việc hoàn thành.',
        board: 'reviews',
        live: 'reviews',
        fields: [
          { key: 'task', label: 'Tin đăng', required: true },
          { key: 'reviewer', label: 'Người đánh giá', required: true },
          { key: 'reviewee', label: 'Người được đánh giá', required: true },
          { key: 'rating', label: 'Số sao', type: 'select', options: STARS, required: true },
          { key: 'comment', label: 'Nhận xét' },
        ],
      },
      {
        id: 'tasks-chats',
        label: 'Tin nhắn',
        hint: 'Các cuộc trò chuyện giữa người đăng và người làm.',
        board: 'chats',
        live: 'chats',
        fields: [
          { key: 'task', label: 'Tin đăng', required: true },
          { key: 'poster', label: 'Người đăng', required: true },
          { key: 'tasker', label: 'Người làm', required: true },
          { key: 'messageCount', label: 'Số tin nhắn', type: 'number' },
          { key: 'lastMessage', label: 'Tin cuối' },
        ],
      },
    ],
  },
  {
    id: 'users',
    label: 'Quản lý người dùng',
    icon: 'people-outline',
    children: [
      {
        id: 'users-all',
        label: 'Tất cả người dùng',
        hint: 'Hồ sơ thành viên đang có trên hệ thống.',
        live: 'users',
        fields: [
          { key: 'name', label: 'Họ tên', required: true },
          { key: 'phone', label: 'Số điện thoại' },
          { key: 'email', label: 'Email' },
          { key: 'wallet', label: 'Số dư ví', type: 'number', money: true },
          { key: 'role', label: 'Quyền', type: 'select', options: ROLE },
        ],
      },
      {
        id: 'users-workers',
        label: 'Người làm việc',
        hint: 'Thành viên đã gửi đề xuất giá.',
        live: 'users',
        fields: [
          { key: 'name', label: 'Họ tên', required: true },
          { key: 'phone', label: 'Số điện thoại' },
          { key: 'wallet', label: 'Số dư ví', type: 'number', money: true },
          { key: 'role', label: 'Quyền', type: 'select', options: ROLE },
        ],
      },
      {
        id: 'users-posters',
        label: 'Người đăng việc',
        hint: 'Thành viên đã đăng tin.',
        live: 'users',
        fields: [
          { key: 'name', label: 'Họ tên', required: true },
          { key: 'phone', label: 'Số điện thoại' },
          { key: 'wallet', label: 'Số dư ví', type: 'number', money: true },
          { key: 'role', label: 'Quyền', type: 'select', options: ROLE },
        ],
      },
      {
        id: 'users-locked',
        label: 'Tài khoản bị khoá',
        hint: 'Danh sách tạm để theo dõi tài khoản cần khoá.',
        fields: [
          { key: 'name', label: 'Họ tên', required: true },
          { key: 'phone', label: 'Số điện thoại' },
          { key: 'reason', label: 'Lý do khoá', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'on', label: 'Đang khoá' },
            { value: 'off', label: 'Đã mở khoá' },
          ] },
        ],
        seed: [
          { name: 'Nguyễn Văn An', phone: '0901111222', reason: 'Spam tin việc', status: 'on' },
          { name: 'Trần Thị Bích', phone: '0913333444', reason: 'Báo cáo lừa đảo', status: 'on' },
        ],
      },
    ],
  },
  {
    id: 'categories',
    label: 'Danh mục',
    icon: 'pricetag-outline',
    children: [
      {
        id: 'categories-jobs',
        label: 'Danh mục việc',
        hint: 'Nhóm việc hiện trên trang chủ.',
        fields: [
          { key: 'name', label: 'Tên danh mục', required: true },
          { key: 'slug', label: 'Mã ngắn' },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE },
        ],
        seed: CATEGORIES.map((item) => ({
          name: item.name,
          slug: item.id,
          status: 'show',
        })),
      },
      {
        id: 'categories-skills',
        label: 'Kỹ năng',
        hint: 'Kỹ năng gắn với người làm.',
        fields: [
          { key: 'name', label: 'Tên kỹ năng', required: true },
          { key: 'group', label: 'Nhóm' },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE },
        ],
        seed: [
          { name: 'Sơn tường', group: 'Sơn nhà', status: 'show' },
          { name: 'Vệ sinh máy lạnh', group: 'Điện nước', status: 'show' },
          { name: 'Lắp kệ gỗ', group: 'Lắp ráp', status: 'show' },
        ],
      },
    ],
  },
  {
    id: 'deposits',
    label: 'Nạp tiền',
    icon: 'wallet-outline',
    children: [
      {
        id: 'deposits-requests',
        label: 'Yêu cầu nạp',
        hint: 'Các lệnh nạp ví đang chờ xử lý.',
        fields: [
          { key: 'user', label: 'Người nạp', required: true },
          { key: 'amount', label: 'Số tiền', type: 'number', money: true, required: true },
          { key: 'method', label: 'Kênh', type: 'select', options: [
            { value: 'bank', label: 'Chuyển khoản' },
            { value: 'momo', label: 'MoMo' },
            { value: 'zalopay', label: 'ZaloPay' },
          ] },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'pending', label: 'Chờ duyệt' },
            { value: 'done', label: 'Đã cộng ví' },
            { value: 'rejected', label: 'Từ chối' },
          ] },
        ],
        seed: [
          { user: 'Lê Minh', amount: '200000', method: 'bank', status: 'pending' },
          { user: 'Phạm Hoa', amount: '500000', method: 'momo', status: 'done' },
        ],
      },
      {
        id: 'deposits-history',
        label: 'Lịch sử nạp',
        hint: 'Các lần nạp đã ghi nhận.',
        fields: [
          { key: 'user', label: 'Người nạp', required: true },
          { key: 'amount', label: 'Số tiền', type: 'number', money: true, required: true },
          { key: 'note', label: 'Ghi chú' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'done', label: 'Thành công' },
            { value: 'failed', label: 'Thất bại' },
          ] },
        ],
        seed: [
          { user: 'Phạm Hoa', amount: '500000', note: 'MoMo 13/10', status: 'done' },
        ],
      },
      {
        id: 'deposits-methods',
        label: 'Kênh nạp tiền',
        hint: 'Bật hoặc tắt từng cách nạp.',
        fields: [
          { key: 'name', label: 'Tên kênh', required: true },
          { key: 'account', label: 'Số tài khoản / ví' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Vietcombank', account: '0123456789', status: 'on' },
          { name: 'MoMo', account: '0900000000', status: 'on' },
        ],
      },
    ],
  },
  {
    id: 'promos',
    label: 'Khuyến mãi & Giảm giá',
    icon: 'gift-outline',
    children: [
      {
        id: 'promos-codes',
        label: 'Mã giảm giá',
        hint: 'Mã cộng tiền vào ví khi người dùng nhập.',
        live: 'vouchers',
        fields: [
          { key: 'code', label: 'Mã', required: true },
          { key: 'title', label: 'Tên hiển thị', required: true },
          { key: 'amount', label: 'Số tiền', type: 'number', money: true, required: true },
          { key: 'maxUses', label: 'Số lượt tối đa', type: 'number' },
          { key: 'used', label: 'Đã dùng', editable: false },
        ],
      },
      {
        id: 'promos-campaigns',
        label: 'Chiến dịch',
        hint: 'Chương trình khuyến mãi theo đợt.',
        fields: [
          { key: 'name', label: 'Tên chiến dịch', required: true },
          { key: 'discount', label: 'Mức ưu đãi', required: true },
          { key: 'period', label: 'Thời gian' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Chào tháng mới', discount: 'Giảm 20.000đ', period: '01/10 - 31/10', status: 'on' },
          { name: 'Giới thiệu bạn', discount: '50.000đ / lượt', period: 'Cả năm', status: 'on' },
        ],
      },
      {
        id: 'promos-deals',
        label: 'Ưu đãi theo danh mục',
        hint: 'Giảm giá riêng cho từng nhóm việc.',
        fields: [
          { key: 'category', label: 'Danh mục', required: true },
          { key: 'discount', label: 'Mức giảm', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { category: 'Dọn dẹp', discount: '10%', status: 'on' },
          { category: 'Sơn nhà', discount: '30.000đ', status: 'off' },
        ],
      },
    ],
  },
  {
    id: 'user-reports',
    label: 'Báo cáo người dùng',
    icon: 'document-text-outline',
    children: [
      {
        id: 'user-reports-abuse',
        label: 'Báo cáo vi phạm',
        hint: 'Tin người dùng gửi lên khi gặp vấn đề.',
        fields: [
          { key: 'target', label: 'Người bị báo cáo', required: true },
          { key: 'reason', label: 'Lý do', required: true },
          { key: 'reporter', label: 'Người gửi' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'new', label: 'Mới' },
            { value: 'review', label: 'Đang xem' },
            { value: 'done', label: 'Đã xử lý' },
          ] },
        ],
        seed: [
          { target: 'Nguyễn Văn An', reason: 'Không đến làm', reporter: 'Mai Lan', status: 'new' },
          { target: 'Trần Thị Bích', reason: 'Tin không đúng', reporter: 'Quốc Huy', status: 'review' },
        ],
      },
      {
        id: 'user-reports-reviews',
        label: 'Khiếu nại đánh giá',
        hint: 'Yêu cầu xem lại sao và nhận xét.',
        fields: [
          { key: 'user', label: 'Người khiếu nại', required: true },
          { key: 'content', label: 'Nội dung', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'new', label: 'Mới' },
            { value: 'done', label: 'Đã xử lý' },
          ] },
        ],
        seed: [
          { user: 'Hoàng Nam', content: 'Đánh giá 1 sao không đúng sự việc', status: 'new' },
        ],
      },
    ],
  },
  {
    id: 'tickets',
    label: 'Phiếu hỗ trợ',
    icon: 'chatbubble-ellipses-outline',
    children: [
      {
        id: 'tickets-open',
        label: 'Phiếu đang mở',
        hint: 'Câu hỏi chưa trả lời xong.',
        fields: [
          { key: 'subject', label: 'Tiêu đề', required: true },
          { key: 'user', label: 'Người gửi', required: true },
          { key: 'body', label: 'Nội dung' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'open', label: 'Đang mở' },
            { value: 'waiting', label: 'Chờ khách' },
          ] },
        ],
        seed: [
          { subject: 'Không nhận được mã', user: 'Thu Hà', body: 'Nhập mã SUMMER không được', status: 'open' },
          { subject: 'Muốn đổi số điện thoại', user: 'Đức Anh', body: 'Số cũ mất sim', status: 'waiting' },
        ],
      },
      {
        id: 'tickets-closed',
        label: 'Phiếu đã xử lý',
        hint: 'Các phiếu đã đóng.',
        fields: [
          { key: 'subject', label: 'Tiêu đề', required: true },
          { key: 'user', label: 'Người gửi' },
          { key: 'result', label: 'Kết quả' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'closed', label: 'Đã đóng' },
          ] },
        ],
        seed: [
          { subject: 'Hướng dẫn đăng việc', user: 'Ngọc Mai', result: 'Đã gọi hướng dẫn', status: 'closed' },
        ],
      },
    ],
  },
  {
    id: 'quests',
    label: 'Nhiệm vụ & Nhận quà',
    icon: 'trophy-outline',
    children: [
      {
        id: 'quests-tasks',
        label: 'Nhiệm vụ',
        hint: 'Việc nhỏ để người dùng làm và nhận thưởng.',
        fields: [
          { key: 'name', label: 'Tên nhiệm vụ', required: true },
          { key: 'reward', label: 'Phần thưởng', required: true },
          { key: 'goal', label: 'Mốc cần đạt' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Điểm danh hôm nay', reward: '2.000đ', goal: '1 lần / ngày', status: 'on' },
          { name: 'Hoàn thành 3 việc', reward: '20.000đ', goal: '3 việc', status: 'on' },
        ],
      },
      {
        id: 'quests-rewards',
        label: 'Phần thưởng',
        hint: 'Quà có thể đổi.',
        fields: [
          { key: 'name', label: 'Tên quà', required: true },
          { key: 'cost', label: 'Điểm đổi', type: 'number', required: true },
          { key: 'stock', label: 'Số lượng', type: 'number' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Thẻ nạp 20.000đ', cost: '100', stock: '50', status: 'on' },
          { name: 'Voucher dọn nhà', cost: '80', stock: '20', status: 'on' },
        ],
      },
      {
        id: 'quests-history',
        label: 'Lịch sử nhận quà',
        hint: 'Ai đã nhận quà nào.',
        fields: [
          { key: 'user', label: 'Người nhận', required: true },
          { key: 'reward', label: 'Quà', required: true },
          { key: 'when', label: 'Thời điểm' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'sent', label: 'Đã trao' },
            { value: 'pending', label: 'Chờ trao' },
          ] },
        ],
        seed: [
          { user: 'Mai Lan', reward: 'Điểm danh 2.000đ', when: 'Hôm nay', status: 'sent' },
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Tài chính',
    icon: 'business-outline',
    children: [
      {
        id: 'finance-wallet',
        label: 'Giao dịch ví',
        hint: 'Tiền vào và tiền ra của ví thành viên.',
        fields: [
          { key: 'user', label: 'Thành viên', required: true },
          { key: 'amount', label: 'Số tiền', type: 'number', money: true, required: true },
          { key: 'kind', label: 'Loại', type: 'select', options: [
            { value: 'in', label: 'Tiền vào' },
            { value: 'out', label: 'Tiền ra' },
          ] },
          { key: 'note', label: 'Nội dung' },
        ],
        seed: [
          { user: 'Lê Minh', amount: '200000', kind: 'in', note: 'Nạp ví' },
          { user: 'Phạm Hoa', amount: '15000', kind: 'out', note: 'Phí đề xuất' },
        ],
      },
      {
        id: 'finance-withdraw',
        label: 'Yêu cầu rút tiền',
        hint: 'Thành viên xin rút ví về tài khoản.',
        fields: [
          { key: 'user', label: 'Người rút', required: true },
          { key: 'amount', label: 'Số tiền', type: 'number', money: true, required: true },
          { key: 'account', label: 'Tài khoản nhận' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'pending', label: 'Chờ duyệt' },
            { value: 'paid', label: 'Đã chuyển' },
            { value: 'rejected', label: 'Từ chối' },
          ] },
        ],
        seed: [
          { user: 'Quốc Huy', amount: '350000', account: 'VCB 998877', status: 'pending' },
        ],
      },
      {
        id: 'finance-fees',
        label: 'Phí nền tảng',
        hint: 'Các khoản phí đang áp dụng.',
        fields: [
          { key: 'name', label: 'Tên phí', required: true },
          { key: 'amount', label: 'Mức phí', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Phí gửi đề xuất', amount: '5.000đ / lượt', status: 'on' },
          { name: 'Phí đăng việc', amount: 'Miễn phí', status: 'on' },
        ],
      },
    ],
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    icon: 'reader-outline',
    children: [
      {
        id: 'reports-revenue',
        label: 'Doanh thu',
        hint: 'Số liệu tiền phí theo ngày. Có thể sửa dòng ghi chú.',
        fields: [
          { key: 'day', label: 'Ngày', required: true },
          { key: 'amount', label: 'Doanh thu', type: 'number', money: true, required: true },
          { key: 'note', label: 'Ghi chú' },
        ],
        seed: [
          { day: '12/10', amount: '180000', note: 'Chủ yếu phí đề xuất' },
          { day: '13/10', amount: '95000', note: 'Cuối tuần chậm' },
        ],
      },
      {
        id: 'reports-jobs',
        label: 'Báo cáo việc làm',
        hint: 'Tóm tắt số tin theo nhóm.',
        fields: [
          { key: 'name', label: 'Nhóm', required: true },
          { key: 'count', label: 'Số tin', type: 'number', required: true },
          { key: 'note', label: 'Ghi chú' },
        ],
        seed: [
          { name: 'Dọn dẹp', count: '24', note: 'Đông nhất' },
          { name: 'Sơn nhà', count: '9', note: '' },
        ],
      },
      {
        id: 'reports-growth',
        label: 'Tăng trưởng người dùng',
        hint: 'Người mới theo tuần.',
        fields: [
          { key: 'week', label: 'Tuần', required: true },
          { key: 'count', label: 'Người mới', type: 'number', required: true },
          { key: 'note', label: 'Ghi chú' },
        ],
        seed: [
          { week: 'Tuần 1 tháng 10', count: '40', note: '' },
          { week: 'Tuần 2 tháng 10', count: '55', note: 'Có chiến dịch giới thiệu' },
        ],
      },
    ],
  },
  {
    id: 'admins',
    label: 'Quản trị viên',
    icon: 'person-outline',
    children: [
      {
        id: 'admins-list',
        label: 'Danh sách quản trị',
        hint: 'Tài khoản được vào khu vực này.',
        live: 'users',
        fields: [
          { key: 'name', label: 'Họ tên', required: true },
          { key: 'phone', label: 'Số điện thoại' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Quyền', type: 'select', options: ROLE },
        ],
      },
      {
        id: 'admins-roles',
        label: 'Vai trò và quyền',
        hint: 'Nhóm quyền để gán cho quản trị viên.',
        fields: [
          { key: 'name', label: 'Tên vai trò', required: true },
          { key: 'rights', label: 'Được làm gì', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Quản trị đầy đủ', rights: 'Thêm, sửa, xoá mọi mục', status: 'on' },
          { name: 'Chăm sóc khách', rights: 'Phiếu hỗ trợ và báo cáo', status: 'on' },
        ],
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Thông báo',
    icon: 'notifications-outline',
    children: [
      {
        id: 'notifications-push',
        label: 'Gửi thông báo',
        hint: 'Tin nhắn đẩy tới điện thoại người dùng.',
        fields: [
          { key: 'title', label: 'Tiêu đề', required: true },
          { key: 'body', label: 'Nội dung', required: true },
          { key: 'audience', label: 'Gửi tới', type: 'select', options: [
            { value: 'all', label: 'Mọi người' },
            { value: 'workers', label: 'Người làm' },
            { value: 'posters', label: 'Người đăng' },
          ] },
          { key: 'status', label: 'Trạng thái', type: 'select', options: [
            { value: 'draft', label: 'Bản nháp' },
            { value: 'sent', label: 'Đã gửi' },
          ] },
        ],
        seed: [
          { title: 'Có việc mới gần bạn', body: 'Mở app để xem tin dọn nhà.', audience: 'workers', status: 'draft' },
        ],
      },
      {
        id: 'notifications-templates',
        label: 'Mẫu thông báo',
        hint: 'Câu chữ dùng lại nhiều lần.',
        fields: [
          { key: 'name', label: 'Tên mẫu', required: true },
          { key: 'body', label: 'Nội dung', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Việc được duyệt', body: 'Tin của bạn đã được mở.', status: 'on' },
          { name: 'Có người chào giá', body: 'Có đề xuất mới cho tin của bạn.', status: 'on' },
        ],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Cài đặt hệ thống',
    icon: 'settings-outline',
    children: [
      {
        id: 'settings-general',
        label: 'Cài đặt chung',
        hint: 'Tên app, hotline và các mục bật tắt.',
        fields: [
          { key: 'name', label: 'Mục', required: true },
          { key: 'value', label: 'Giá trị', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Tên ứng dụng', value: 'Việc Nhanh', status: 'on' },
          { name: 'Hotline', value: '1900 0000', status: 'on' },
        ],
      },
      {
        id: 'settings-limits',
        label: 'Phí và hạn mức',
        hint: 'Ngưỡng tiền và số lượt.',
        fields: [
          { key: 'name', label: 'Mục', required: true },
          { key: 'value', label: 'Giá trị', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Rút tối thiểu', value: '50.000đ', status: 'on' },
          { name: 'Đề xuất tối đa / ngày', value: '20', status: 'on' },
        ],
      },
      {
        id: 'settings-content',
        label: 'Nội dung hiển thị',
        hint: 'Câu chữ trên trang giới thiệu.',
        fields: [
          { key: 'name', label: 'Vị trí', required: true },
          { key: 'value', label: 'Nội dung', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: SHOW_HIDE },
        ],
        seed: [
          { name: 'Dòng chào trang chủ', value: 'Tìm người làm quanh bạn', status: 'show' },
        ],
      },
    ],
  },
  {
    id: 'extras',
    label: 'Tiện ích thêm',
    icon: 'ellipsis-horizontal-circle-outline',
    children: [
      {
        id: 'extras-banners',
        label: 'Ảnh banner',
        hint: 'Ảnh chạy trên đầu trang.',
        fields: [
          { key: 'title', label: 'Tiêu đề', required: true },
          { key: 'link', label: 'Đường dẫn' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: SHOW_HIDE },
        ],
        seed: [
          { title: 'Giảm giá dọn nhà cuối tuần', link: '/browse', status: 'show' },
        ],
      },
      {
        id: 'extras-faq',
        label: 'Câu hỏi thường gặp',
        hint: 'Mục hỏi đáp cho người dùng.',
        fields: [
          { key: 'question', label: 'Câu hỏi', required: true },
          { key: 'answer', label: 'Câu trả lời', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: SHOW_HIDE },
        ],
        seed: [
          { question: 'Đăng việc có mất phí không?', answer: 'Hiện đăng việc miễn phí.', status: 'show' },
          { question: 'Rút tiền mất bao lâu?', answer: 'Trong 1 ngày làm việc sau khi duyệt.', status: 'show' },
        ],
      },
      {
        id: 'extras-pages',
        label: 'Trang tĩnh',
        hint: 'Trang điều khoản, giới thiệu.',
        fields: [
          { key: 'title', label: 'Tên trang', required: true },
          { key: 'body', label: 'Nội dung', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: SHOW_HIDE },
        ],
        seed: [
          { title: 'Điều khoản sử dụng', body: 'Nội dung điều khoản sẽ bổ sung sau.', status: 'show' },
          { title: 'Chính sách riêng tư', body: 'Nội dung chính sách sẽ bổ sung sau.', status: 'show' },
        ],
      },
    ],
  },
];

export function findAdminPage(id) {
  for (const item of ADMIN_MENU) {
    if (item.id === id) return item;
    const child = (item.children || []).find((page) => page.id === id);
    if (child) return { ...child, parentId: item.id, parentLabel: item.label };
  }
  return ADMIN_MENU[0];
}

export function seedAdminStores() {
  const stores = {};
  for (const item of ADMIN_MENU) {
    for (const page of item.children || []) {
      stores[page.id] = (page.seed || []).map((row, index) => ({
        id: `${page.id}-${index + 1}`,
        ...row,
      }));
    }
  }
  return stores;
}

function jobToRow(job) {
  return {
    id: job.id,
    title: job.title || 'Chưa có tiêu đề',
    owner: job.poster?.full_name || 'Ẩn danh',
    ownerId: job.user_id || '',
    category: getCategoryById(job.category_id)?.name || 'Khác',
    categoryId: job.category_id || '',
    location: formatArea(job.province_id, job.ward_id),
    bids: String(Array.isArray(job.bids) ? job.bids.length : 0),
    price: String(job.price ?? 0),
    status: job.status || 'pending',
    assignee: job.assignee?.full_name || '',
    createdAt: job.created_at || '',
  };
}

function bidToRow(bid) {
  return {
    id: bid.id,
    task: bid.job?.title || 'Tin đã xoá',
    tasker: bid.worker?.full_name || 'Ẩn danh',
    price: String(bid.proposed_price ?? 0),
    status: bid.status || 'pending',
    note: bid.message || '',
    createdAt: bid.created_at || '',
  };
}

function reviewToRow(row) {
  return {
    id: row.id,
    task: row.job?.title || 'Tin đã xoá',
    reviewer: row.reviewer?.full_name || 'Ẩn danh',
    reviewee: row.subject?.full_name || 'Ẩn danh',
    rating: String(row.rating ?? 5),
    comment: row.comment || '',
    createdAt: row.created_at || '',
  };
}

function chatToRow(row) {
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const latest = [...messages].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
  return {
    id: row.id,
    task: row.job?.title || 'Tin đã xoá',
    poster: row.poster?.full_name || 'Ẩn danh',
    tasker: row.worker?.full_name || 'Ẩn danh',
    messageCount: String(messages.length),
    lastMessage: latest?.body || '',
    createdAt: latest?.created_at || row.created_at || '',
  };
}

function userToRow(user) {
  return {
    id: user.id,
    name: user.full_name || 'Chưa đặt tên',
    phone: user.phone || '',
    email: user.email || '',
    wallet: String(user.wallet_balance ?? 0),
    role: user.is_admin ? 'admin' : 'member',
  };
}

function voucherToRow(row) {
  return {
    id: row.id,
    code: row.code || '',
    title: row.title || '',
    amount: String(row.amount ?? 0),
    maxUses: row.max_uses == null ? '' : String(row.max_uses),
    used: String(row.used_count ?? 0),
  };
}

export function mergeLiveAdminData(stores, { jobs = [], users = [], bids = [], vouchers = [], reviews = [], chats = [] }) {
  const next = { ...stores };
  const jobRows = jobs.map(jobToRow);
  const userRows = users.map(userToRow);
  const posterIds = new Set(jobs.map((job) => job.user_id).filter(Boolean));
  const workerIds = new Set(bids.map((bid) => bid.worker_id).filter(Boolean));

  next['tasks-posts'] = jobRows;
  next['tasks-bids'] = bids.map(bidToRow);
  next['tasks-reviews'] = reviews.map(reviewToRow);
  next['tasks-chats'] = chats.map(chatToRow);
  next['users-all'] = userRows;
  next['users-workers'] = userRows.filter((row) => workerIds.has(row.id));
  next['users-posters'] = userRows.filter((row) => posterIds.has(row.id));
  next['admins-list'] = userRows.filter((row) => row.role === 'admin');
  next['promos-codes'] = vouchers.map(voucherToRow);
  return next;
}
