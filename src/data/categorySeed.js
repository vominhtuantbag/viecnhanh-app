export const BASE_CATEGORIES = [
  { id: 'gardening', name: 'Làm vườn', icon: 'leaf-outline' },
  { id: 'painting', name: 'Sơn nhà', icon: 'color-palette-outline' },
  { id: 'cleaning', name: 'Dọn dẹp', icon: 'sparkles-outline' },
  { id: 'handyman', name: 'Sửa chữa nhà cửa', icon: 'construct-outline' },
  { id: 'delivery', name: 'Giao hàng', icon: 'bicycle-outline' },
  { id: 'assembly', name: 'Lắp ráp nội thất', icon: 'cube-outline' },
  { id: 'soundproofing', name: 'Cách âm', icon: 'volume-mute-outline' },
  { id: 'advisory', name: 'Tư vấn', icon: 'chatbubbles-outline' },
  { id: 'beauty', name: 'Dịch vụ làm đẹp', icon: 'flower-outline' },
  { id: 'moving', name: 'Chuyển nhà', icon: 'car-outline' },
  { id: 'tutoring', name: 'Gia sư', icon: 'school-outline' },
  { id: 'it', name: 'Công nghệ & máy tính', icon: 'laptop-outline' },
  { id: 'photography', name: 'Nhiếp ảnh', icon: 'camera-outline' },
  { id: 'pet', name: 'Chăm sóc thú cưng', icon: 'paw-outline' },
  { id: 'electrical', name: 'Điện nước', icon: 'flash-outline' },
];

export const POPULAR_IDS = ['gardening', 'painting', 'cleaning', 'handyman', 'delivery', 'assembly'];

export const BASE_SUBS = [
  { id: 'sub-garden-trim', name: 'Cắt tỉa cây', parentId: 'gardening', status: 'show' },
  { id: 'sub-paint-wall', name: 'Sơn tường', parentId: 'painting', status: 'show' },
  { id: 'sub-paint-door', name: 'Sơn cửa', parentId: 'painting', status: 'show' },
  { id: 'sub-clean-house', name: 'Dọn nhà', parentId: 'cleaning', status: 'show' },
  { id: 'sub-clean-carpet', name: 'Giặt thảm', parentId: 'cleaning', status: 'show' },
  { id: 'sub-handyman-wood', name: 'Sửa đồ gỗ', parentId: 'handyman', status: 'show' },
  { id: 'sub-delivery-food', name: 'Giao đồ ăn', parentId: 'delivery', status: 'show' },
  { id: 'sub-assembly-shelf', name: 'Lắp kệ gỗ', parentId: 'assembly', status: 'show' },
  { id: 'sub-electric-ac', name: 'Vệ sinh máy lạnh', parentId: 'electrical', status: 'show' },
  { id: 'sub-electric-pipe', name: 'Sửa ống nước', parentId: 'electrical', status: 'show' },
];

export const BASE_SKILLS = [
  { id: 'skill-paint', name: 'Sơn tường', parentId: 'painting', status: 'show' },
  { id: 'skill-ac', name: 'Vệ sinh máy lạnh', parentId: 'electrical', status: 'show' },
  { id: 'skill-shelf', name: 'Lắp kệ gỗ', parentId: 'assembly', status: 'show' },
  { id: 'skill-garden', name: 'Cắt cỏ', parentId: 'gardening', status: 'show' },
  { id: 'skill-clean', name: 'Lau kính', parentId: 'cleaning', status: 'show' },
];
