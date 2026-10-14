const fs = require('fs');
const path = require('path');

const source = path.join(process.env.TEMP, 'vn-address.json');
const tables = JSON.parse(fs.readFileSync(source, 'utf8'));
const by = {};
for (const table of tables) by[table.name] = table.data;

const ABBR = {
  'Hà Giang': 'HG',
  'Yên Bái': 'YB',
  'Bắc Kạn': 'BK',
  'Vĩnh Phúc': 'VP',
  'Hòa Bình': 'HB',
  'Bắc Giang': 'BG',
  'Thái Bình': 'TB',
  'Hải Dương': 'HD',
  'Nam Định': 'NĐ',
  'Hà Nam': 'HNa',
  'Quảng Bình': 'QB',
  'Quảng Nam': 'QNa',
  'Kon Tum': 'KT',
  'Bình Định': 'BĐ',
  'Ninh Thuận': 'NT',
  'Đắk Nông': 'ĐNo',
  'Bình Thuận': 'BT',
  'Phú Yên': 'PY',
  'Bình Dương': 'BD',
  'Bà Rịa - Vũng Tàu': 'BRVT',
  'Bình Phước': 'BP',
  'Long An': 'LA',
  'Sóc Trăng': 'ST',
  'Hậu Giang': 'HGi',
  'Bến Tre': 'BTr',
  'Trà Vinh': 'TV',
  'Tiền Giang': 'TG',
  'Bạc Liêu': 'BL',
  'Kiên Giang': 'KG',
};

function core(name) {
  return String(name || '')
    .replace(/^Thành phố\s+/i, '')
    .replace(/^Tỉnh\s+/i, '')
    .replace(/Hoà/g, 'Hòa')
    .trim();
}

const mapsByWard = new Map();
for (const item of by.ward_mappings) {
  const list = mapsByWard.get(item.new_ward_code) || [];
  list.push(item);
  mapsByWard.set(item.new_ward_code, list);
}

const provinces = by.provinces
  .map((item) => ({
    id: item.province_code,
    name: core(item.name),
    wards: [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

const provinceByCode = new Map(provinces.map((item) => [item.id, item]));
let suffixed = 0;

for (const ward of by.wards) {
  const province = provinceByCode.get(ward.province_code);
  if (!province) continue;
  const host = province.name;
  const counts = new Map();
  for (const item of mapsByWard.get(ward.ward_code) || []) {
    const oldName = core(item.old_province_name);
    if (!oldName || oldName === host) continue;
    const abbr = ABBR[oldName];
    if (!abbr) continue;
    counts.set(abbr, (counts.get(abbr) || 0) + 1);
  }
  let name = ward.name;
  if (counts.size) {
    const abbr = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    name = `${ward.name} - ${abbr} cũ`;
    suffixed += 1;
  }
  province.wards.push({ id: ward.ward_code, name });
}

for (const province of provinces) {
  province.wards.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

const anGiang = provinces.find((item) => item.name === 'An Giang');
const samples = anGiang.wards.filter((item) => /Tịnh Biên|Rạch Giá/.test(item.name));
const wardCount = provinces.reduce((sum, item) => sum + item.wards.length, 0);
console.log(JSON.stringify({ provinces: provinces.length, wards: wardCount, suffixed, samples }, null, 2));
console.log(provinces.map((item) => `${item.id} ${item.name} (${item.wards.length})`).join('\n'));

const out = path.join(__dirname, '..', 'src', 'data', 'vnAreas.json');
fs.writeFileSync(out, JSON.stringify(provinces));
console.log('wrote', out, fs.statSync(out).size);
