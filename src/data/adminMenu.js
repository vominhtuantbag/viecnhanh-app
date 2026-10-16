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
const AREA_KIND = [
  { value: 'province', label: 'Tỉnh/thành' },
  { value: 'ward', label: 'Xã/phường' },
];

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
        id: 'users-list',
        label: 'Người dùng',
        hint: 'Danh sách thành viên, cộng tiền hoặc khoá tài khoản.',
        board: 'users',
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
        id: 'users-verify',
        label: 'Xác minh',
        hint: 'Duyệt hồ sơ đã gửi giấy tờ.',
        board: 'verify',
        live: 'users',
        fields: [
          { key: 'name', label: 'Họ tên', required: true },
          { key: 'phone', label: 'Số điện thoại' },
          { key: 'email', label: 'Email' },
        ],
      },
      {
        id: 'users-create',
        label: 'Thêm người dùng',
        hint: 'Tạo hồ sơ mới cho quản trị theo dõi.',
        board: 'create',
        live: 'users',
        fields: [
          { key: 'name', label: 'Họ tên', required: true },
          { key: 'phone', label: 'Số điện thoại', required: true },
          { key: 'email', label: 'Email' },
          { key: 'wallet', label: 'Số dư ví ban đầu', type: 'number', money: true },
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
        id: 'categories-main',
        label: 'Danh mục chính',
        hint: 'Nhóm việc lớn hiện trên trang chủ và bộ lọc.',
        fields: [
          { key: 'name', label: 'Tên danh mục', required: true },
          { key: 'iconUrl', label: 'Icon', type: 'image', bucket: 'category-icons' },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE, tab: true },
        ],
      },
      {
        id: 'categories-sub',
        label: 'Danh mục con',
        hint: 'Nhóm nhỏ hơn, luôn gắn với một danh mục chính.',
        fields: [
          { key: 'parentId', label: 'Danh mục chính', type: 'select', options: CATEGORY_OPTIONS, required: true },
          { key: 'name', label: 'Tên danh mục con', required: true },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE, tab: true },
        ],
      },
      {
        id: 'categories-skills',
        label: 'Kỹ năng',
        hint: 'Kỹ năng thuộc một danh mục chính.',
        fields: [
          { key: 'parentId', label: 'Danh mục chính', type: 'select', options: CATEGORY_OPTIONS, required: true },
          { key: 'name', label: 'Tên kỹ năng', required: true },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE, tab: true },
        ],
      },
      {
        id: 'categories-areas',
        label: 'Khu vực',
        hint: '34 tỉnh/thành và toàn bộ xã/phường. Xã/phường từ tỉnh cũ có hậu tố.',
        fields: [
          { key: 'kind', label: 'Loại', type: 'select', options: AREA_KIND, tab: true },
          { key: 'parentId', label: 'Tỉnh/thành', type: 'select', options: [] },
          { key: 'name', label: 'Tên', required: true },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE },
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
        hint: 'Thêm, sửa hoặc ẩn nhiệm vụ. App chỉ hiện nhiệm vụ đang bật.',
        live: 'reward-tasks',
        fields: [
          { key: 'title', label: 'Tên nhiệm vụ', required: true },
          { key: 'description', label: 'Mô tả' },
          { key: 'actionType', label: 'Việc cần làm', type: 'select', options: [
            { value: 'daily_checkin', label: 'Điểm danh' },
            { value: 'golden_hour', label: 'Khung giờ vàng' },
            { value: 'browse_jobs', label: 'Xem việc' },
            { value: 'share_job', label: 'Chia sẻ / có lượt xem' },
            { value: 'complete_profile', label: 'Hoàn thiện hồ sơ' },
            { value: 'apply_job', label: 'Gửi đề xuất' },
            { value: 'complete_job', label: 'Hoàn thành việc' },
            { value: 'five_star', label: 'Được 5 sao' },
            { value: 'write_review', label: 'Viết đánh giá' },
            { value: 'post_job', label: 'Đăng tin' },
            { value: 'refer_user', label: 'Mời bạn' },
          ] },
          { key: 'groupKey', label: 'Nhóm', type: 'select', options: [
            { value: 'daily', label: 'Điểm danh' },
            { value: 'explore', label: 'Khám phá' },
            { value: 'core', label: 'Việc làm' },
            { value: 'referral', label: 'Giới thiệu' },
          ] },
          { key: 'targetCount', label: 'Số lần cần đạt', type: 'number', required: true },
          { key: 'rewardPoints', label: 'Xu thưởng', type: 'number', required: true },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE, tab: true },
        ],
      },
      {
        id: 'quests-rewards',
        label: 'Phần thưởng',
        hint: 'Quà người dùng đổi bằng xu.',
        live: 'rewards',
        fields: [
          { key: 'title', label: 'Tên quà', required: true },
          { key: 'type', label: 'Loại quà', type: 'select', options: [
            { value: 'app_balance', label: 'Cộng ví' },
            { value: 'voucher', label: 'Mã giảm giá' },
            { value: 'badge', label: 'Huy hiệu' },
            { value: 'boost', label: 'Lượt đẩy tin' },
            { value: 'phone_card', label: 'Thẻ cào' },
            { value: 'data_4g', label: 'Data 4G' },
            { value: 'partner_voucher', label: 'Voucher đối tác' },
            { value: 'lucky_spin', label: 'Vòng quay' },
            { value: 'mystery_box', label: 'Hộp quà' },
            { value: 'physical_gift', label: 'Quà hiện vật' },
          ] },
          { key: 'groupKey', label: 'Nhóm', type: 'select', options: [
            { value: 'wallet', label: 'Tiền ví' },
            { value: 'perk', label: 'Đặc quyền' },
            { value: 'life', label: 'Tiêu dùng' },
            { value: 'luck', label: 'May mắn' },
          ] },
          { key: 'value', label: 'Mệnh giá', type: 'number', money: true },
          { key: 'pointCost', label: 'Xu cần đổi', type: 'number', required: true },
          { key: 'stock', label: 'Số lượng còn', type: 'number' },
          { key: 'imageUrl', label: 'Ảnh' },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE, tab: true },
        ],
      },
      {
        id: 'quests-wheel',
        label: 'Vòng quay',
        hint: 'Tỷ lệ các giải đang hiện phải cộng đúng 100%. Đổi một giải thì các giải đang hiện khác được chia lại cho đủ 100%.',
        live: 'wheel-prizes',
        fields: [
          { key: 'prizeName', label: 'Tên giải', required: true },
          { key: 'prizeType', label: 'Loại giải', type: 'select', options: [
            { value: 'coin', label: 'Xu' },
            { value: 'voucher', label: 'Voucher' },
            { value: 'item', label: 'Hiện vật' },
          ] },
          { key: 'value', label: 'Số xu cộng', type: 'number' },
          { key: 'probability', label: 'Tỷ lệ (%)', type: 'number', required: true },
          { key: 'sortOrder', label: 'Thứ tự trên vòng', type: 'number' },
          { key: 'iconUrl', label: 'Ảnh' },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE, tab: true },
        ],
        seed: [
          { prizeName: '50 xu', prizeType: 'coin', value: '50', probability: '40', sortOrder: '1', status: 'show' },
          { prizeName: '100 xu', prizeType: 'coin', value: '100', probability: '30', sortOrder: '2', status: 'show' },
          { prizeName: '200 xu', prizeType: 'coin', value: '200', probability: '18', sortOrder: '3', status: 'show' },
          { prizeName: '500 xu', prizeType: 'coin', value: '500', probability: '9', sortOrder: '4', status: 'show' },
          { prizeName: '1000 xu', prizeType: 'coin', value: '1000', probability: '3', sortOrder: '5', status: 'show' },
        ],
      },
      {
        id: 'quests-mystery',
        label: 'Hộp quà',
        hint: 'Tỷ lệ các giải đang hiện phải cộng đúng 100%. Đổi một giải thì các giải đang hiện khác được chia lại cho đủ 100%.',
        live: 'mystery-prizes',
        fields: [
          { key: 'prizeName', label: 'Tên giải', required: true },
          { key: 'prizeType', label: 'Loại giải', type: 'select', options: [
            { value: 'coin', label: 'Xu' },
            { value: 'voucher', label: 'Voucher' },
            { value: 'item', label: 'Hiện vật' },
          ] },
          { key: 'value', label: 'Số xu cộng', type: 'number' },
          { key: 'probability', label: 'Tỷ lệ (%)', type: 'number', required: true },
          { key: 'sortOrder', label: 'Thứ tự', type: 'number' },
          { key: 'status', label: 'Hiển thị', type: 'select', options: SHOW_HIDE, tab: true },
        ],
        seed: [
          { prizeName: '200 xu', prizeType: 'coin', value: '200', probability: '50', sortOrder: '1', status: 'show' },
          { prizeName: '500 xu', prizeType: 'coin', value: '500', probability: '30', sortOrder: '2', status: 'show' },
          { prizeName: '1000 xu', prizeType: 'coin', value: '1000', probability: '15', sortOrder: '3', status: 'show' },
          { prizeName: '2000 xu', prizeType: 'coin', value: '2000', probability: '5', sortOrder: '4', status: 'show' },
        ],
      },
      {
        id: 'quests-history',
        label: 'Yêu cầu đổi quà',
        hint: 'Duyệt và gửi mã thẻ cào hoặc voucher.',
        live: 'reward-claims',
        allowCreate: false,
        fields: [
          { key: 'user', label: 'Người đổi', editable: false },
          { key: 'reward', label: 'Quà', editable: false },
          { key: 'claimCode', label: 'Mã thẻ / voucher' },
          { key: 'status', label: 'Trạng thái', type: 'select', tab: true, options: [
            { value: 'pending', label: 'Chờ gửi' },
            { value: 'completed', label: 'Đã nhận' },
            { value: 'rejected', label: 'Từ chối' },
          ] },
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
        hint: 'Chiến dịch đẩy tới điện thoại: gửi ngay, hẹn giờ hoặc lặp lại.',
        board: 'campaigns',
      },
      {
        id: 'notifications-templates',
        label: 'Mẫu thông báo',
        hint: 'Câu chạy dưới ảnh bìa trang chủ. Chỉ mẫu đang bật mới hiện, và tự đổi mỗi 10 giây.',
        fields: [
          { key: 'name', label: 'Tên mẫu', required: true },
          { key: 'body', label: 'Nội dung', required: true },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ON_OFF },
        ],
        seed: [
          { name: 'Mẹo vặt', body: 'Nhanh tay gửi báo giá để được xem trước.', status: 'on' },
          { name: 'Mẹo vặt', body: 'Làm nhiệm vụ hệ thống để nhận quà', status: 'on' },
          { name: 'Thông báo', body: 'Không chuyển tiền trước tránh lừa đảo', status: 'on' },
          { name: 'Khuyến mãi', body: 'Mã giảm giá 10% dùng cho cả tuần nè!', status: 'on' },
          { name: 'Hướng dẫn', body: 'Cách sử dụng app hiệu quả', status: 'on' },
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
        hint: 'Ảnh chạy trên đầu trang chủ. Nên giữ 3 ảnh đang hiện.',
        fields: [
          { key: 'title', label: 'Tiêu đề', required: true },
          { key: 'imageUrl', label: 'Ảnh', type: 'image', bucket: 'banner-images' },
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

function handleFrom(name, phone, code) {
  if (code) return `@${String(code).toLowerCase()}`;
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
  if (base) return `@${base}`;
  const tail = String(phone || '').replace(/\D/g, '').slice(-4);
  return tail ? `@user${tail}` : '@thanhvien';
}

function userToRow(user) {
  const name = user.full_name || 'Chưa đặt tên';
  return {
    id: user.id,
    name,
    handle: handleFrom(name, user.phone, user.referral_code),
    phone: user.phone || '',
    email: user.email || '',
    wallet: String(user.wallet_balance ?? 0),
    role: user.is_admin ? 'admin' : 'member',
    verified: !!user.id_verified,
    status: user.is_banned ? 'banned' : 'active',
    createdAt: user.created_at || '',
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

export function replaceAdminUsers(stores, users = []) {
  const userRows = users.map(userToRow);
  return {
    ...stores,
    'users-list': userRows,
    'users-verify': userRows,
    'users-all': userRows,
    'admins-list': userRows.filter((row) => row.role === 'admin'),
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
  next['users-list'] = userRows;
  next['users-verify'] = userRows;
  next['users-all'] = userRows;
  next['users-workers'] = userRows.filter((row) => workerIds.has(row.id));
  next['users-posters'] = userRows.filter((row) => posterIds.has(row.id));
  next['admins-list'] = userRows.filter((row) => row.role === 'admin');
  next['promos-codes'] = vouchers.map(voucherToRow);
  return next;
}
