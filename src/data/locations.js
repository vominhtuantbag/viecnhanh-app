import { getCatalog, visibleProvinces } from '@/data/catalog';

const LEGACY = {
  hn: '01',
  hcm: '79',
  dn: '48',
  hp: '31',
};

export function canonicalProvinceId(id) {
  if (!id || id === 'all') return id || '';
  return LEGACY[id] || id;
}

export function sameProvince(left, right) {
  return canonicalProvinceId(left) === canonicalProvinceId(right);
}

export function getProvinces() {
  return getCatalog().provinces;
}

export function getVisibleProvinces() {
  return visibleProvinces();
}

export function getProvinceById(provinceId) {
  const id = canonicalProvinceId(provinceId);
  return getCatalog().provinces.find((item) => item.id === id) ?? null;
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
