export const PROVINCES = [
  {
    id: 'hn',
    name: 'Hà Nội',
    wards: [
      { id: 'hn-ck', name: 'Phường Cửa Nam' },
      { id: 'hn-hk', name: 'Phường Hoàn Kiếm' },
      { id: 'hn-da', name: 'Xã Đông Anh' },
    ],
  },
  {
    id: 'hcm',
    name: 'TP. Hồ Chí Minh',
    wards: [
      { id: 'hcm-bt', name: 'Phường Bến Thành' },
      { id: 'hcm-td', name: 'Phường Tân Định' },
      { id: 'hcm-tb', name: 'Phường Thủ Đức' },
    ],
  },
  {
    id: 'dn',
    name: 'Đà Nẵng',
    wards: [
      { id: 'dn-hc', name: 'Phường Hải Châu' },
      { id: 'dn-tk', name: 'Phường Thanh Khê' },
    ],
  },
  {
    id: 'hp',
    name: 'Hải Phòng',
    wards: [
      { id: 'hp-ng', name: 'Phường Ngô Quyền' },
      { id: 'hp-lc', name: 'Phường Lê Chân' },
    ],
  },
];

export function getProvinceById(provinceId) {
  return PROVINCES.find((item) => item.id === provinceId) ?? null;
}

export function getWardById(provinceId, wardId) {
  const province = getProvinceById(provinceId);
  return province?.wards.find((item) => item.id === wardId) ?? null;
}

export function formatArea(provinceId, wardId) {
  const province = getProvinceById(provinceId);
  const ward = getWardById(provinceId, wardId);
  if (!province) return 'Chưa chọn khu vực';
  if (!ward) return province.name;
  return `${ward.name}, ${province.name}`;
}
