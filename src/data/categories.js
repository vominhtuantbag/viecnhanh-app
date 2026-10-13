export const CATEGORIES = [
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

export const POPULAR_CATEGORIES = CATEGORIES.filter((item) =>
  ['gardening', 'painting', 'cleaning', 'handyman', 'delivery', 'assembly'].includes(item.id)
);

export function getCategoryById(id) {
  return CATEGORIES.find((item) => item.id === id) ?? null;
}
