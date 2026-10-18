import { getProvinces } from '@/data/locations';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

let nextRequestAt = 0;

function pace() {
  const now = Date.now();
  const start = Math.max(now, nextRequestAt);
  nextRequestAt = start + 1100;
  const wait = start - now;
  if (!wait) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, wait));
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plainName(value) {
  return fold(value)
    .replace(/^(tinh|thanh pho|tp|thi xa|quan|huyen|thi tran|xa|phuong|dac khu)\s+/, '')
    .replace(/\s+city$/, '')
    .replace(/\s+-\s+.*$/, '')
    .trim();
}

function isCoord(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function haversineKm(from, to) {
  if (!isCoord(from?.latitude, from?.longitude) || !isCoord(to?.latitude, to?.longitude)) return null;
  const rad = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * rad;
  const dLng = (to.longitude - from.longitude) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatAway(km) {
  const value = Number(km);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1) return `Cách bạn khoảng ${Math.max(1, Math.round(value * 1000))} m`;
  return `Cách bạn khoảng ${value.toFixed(1)} km`;
}

export function jobPoint(job) {
  if (isCoord(job?.latitude, job?.longitude)) {
    return { latitude: Number(job.latitude), longitude: Number(job.longitude) };
  }
  if (isCoord(job?.poster?.latitude, job?.poster?.longitude)) {
    return { latitude: Number(job.poster.latitude), longitude: Number(job.poster.longitude) };
  }
  return null;
}

async function nominatim(path) {
  await pace();
  const response = await fetch(`${NOMINATIM}${path}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi',
      'User-Agent': 'ViecNhanh/1.0 (ung dung tim viec gan nha)',
    },
  });
  if (!response.ok) throw new Error('Không tra được bản đồ.');
  return response.json();
}

function bestProvince(address) {
  const provinces = getProvinces();
  const iso = String(address?.['ISO3166-2-lvl4'] || address?.['ISO3166-2-lvl3'] || '');
  const isoId = iso.match(/(\d{2})$/)?.[1];
  if (isoId) {
    const byCode = provinces.find((item) => item.id === isoId);
    if (byCode) return byCode;
  }
  const hints = [address?.state, address?.province, address?.city, address?.region].filter(Boolean).map(plainName);
  let winner = null;
  let score = 0;
  for (const province of provinces) {
    const name = plainName(province.name);
    if (!name) continue;
    for (const hint of hints) {
      if (!hint) continue;
      if (hint === name && score < 3) {
        winner = province;
        score = 3;
      } else if ((hint.includes(name) || name.includes(hint)) && name.length > 3 && score < 2) {
        winner = province;
        score = 2;
      }
    }
  }
  return winner;
}

function bestWard(wards, address) {
  const hints = [
    address?.suburb,
    address?.quarter,
    address?.neighbourhood,
    address?.city_district,
    address?.municipality,
    address?.village,
    address?.town,
    address?.hamlet,
  ]
    .filter(Boolean)
    .map(plainName)
    .filter((item) => item.length > 2);
  let winner = null;
  let score = 0;
  for (const ward of wards || []) {
    const name = plainName(ward.name);
    if (!name || name.length < 3) continue;
    for (const hint of hints) {
      if (hint === name && score < 3) {
        winner = ward;
        score = 3;
      } else if ((hint.includes(name) || name.includes(hint)) && score < 2) {
        winner = ward;
        score = 2;
      }
    }
  }
  return winner;
}

export async function searchAddresses(query) {
  const text = String(query || '').trim();
  if (text.length < 2) return [];
  const rows = await nominatim(
    `/search?format=json&limit=5&countrycodes=vn&q=${encodeURIComponent(text)}`
  );
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: String(row.place_id || `${row.lat},${row.lon}`),
      label: row.display_name || '',
      latitude: Number(row.lat),
      longitude: Number(row.lon),
    }))
    .filter((item) => item.label && isCoord(item.latitude, item.longitude));
}

export async function areaFromCoordinates(coords) {
  if (!isCoord(coords?.latitude, coords?.longitude)) return null;
  const data = await nominatim(
    `/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${coords.latitude}&lon=${coords.longitude}`
  );
  const address = data?.address || {};
  const province = bestProvince(address);
  if (!province) return { provinceId: '', wardId: '', label: data?.display_name || '' };
  const ward = bestWard(province.wards, address);
  return {
    provinceId: province.id,
    wardId: ward?.id || '',
    label: data?.display_name || '',
  };
}

export async function coordinatesForArea(provinceId, wardId) {
  const provinces = getProvinces();
  const province = provinces.find((item) => item.id === provinceId);
  const ward = province?.wards?.find((item) => item.id === wardId);
  if (!province) return null;
  const query = [ward?.name, province.name, 'Việt Nam'].filter(Boolean).join(', ');
  const rows = await nominatim(`/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(query)}`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!isCoord(row?.lat, row?.lon)) return null;
  return { latitude: Number(row.lat), longitude: Number(row.lon) };
}

export async function roadDistanceKm(from, to) {
  const straight = haversineKm(from, to);
  if (straight == null) return null;
  try {
    const url = `${OSRM}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return straight;
    const data = await response.json();
    const meters = Number(data?.routes?.[0]?.distance);
    if (!Number.isFinite(meters) || meters <= 0) return straight;
    return meters / 1000;
  } catch {
    return straight;
  }
}
