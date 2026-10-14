import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_CATEGORIES, BASE_SKILLS, BASE_SUBS, POPULAR_IDS } from '@/data/categorySeed';
import baseAreas from '@/data/vnAreas.json';

const KEY = 'viecnhanh.catalog.v1';

function seedMains() {
  return BASE_CATEGORIES.map((item) => ({ ...item, status: 'show' }));
}

function emptyOverrides() {
  return {
    mains: null,
    subs: null,
    skills: null,
    provincePatches: {},
    wardPatches: {},
    addedProvinces: [],
    addedWards: [],
    removed: [],
  };
}

function readSync() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {
    return null;
  }
  return null;
}

function findBaseWard(id) {
  for (const province of baseAreas) {
    const ward = province.wards.find((item) => item.id === id);
    if (ward) return { ...ward, provinceId: province.id };
  }
  return null;
}

function buildAreas(overrides) {
  const removed = new Set(overrides.removed || []);
  const provincePatches = overrides.provincePatches || {};
  const wardPatches = overrides.wardPatches || {};
  const provinces = [];

  for (const base of baseAreas) {
    if (removed.has(base.id)) continue;
    const patch = provincePatches[base.id] || {};
    const wards = [];
    for (const ward of base.wards) {
      if (removed.has(ward.id)) continue;
      const wardPatch = wardPatches[ward.id] || {};
      if (wardPatch.provinceId && wardPatch.provinceId !== base.id) continue;
      wards.push({
        id: ward.id,
        name: wardPatch.name || ward.name,
        status: wardPatch.status || 'show',
        provinceId: base.id,
      });
    }
    provinces.push({
      id: base.id,
      name: patch.name || base.name,
      status: patch.status || 'show',
      wards,
    });
  }

  for (const extra of overrides.addedProvinces || []) {
    if (removed.has(extra.id) || provinces.some((item) => item.id === extra.id)) continue;
    provinces.push({
      id: extra.id,
      name: extra.name,
      status: extra.status || 'show',
      wards: [],
    });
  }

  const extras = (overrides.addedWards || []).concat(
    Object.entries(wardPatches)
      .filter(([, patch]) => patch.provinceId)
      .map(([id, patch]) => ({ id, ...patch }))
  );

  for (const ward of extras) {
    if (removed.has(ward.id)) continue;
    const parent = provinces.find((item) => item.id === ward.provinceId);
    if (!parent || parent.wards.some((item) => item.id === ward.id)) continue;
    const baseWard = findBaseWard(ward.id);
    parent.wards.push({
      id: ward.id,
      name: ward.name || baseWard?.name || 'Xã/phường',
      status: ward.status || 'show',
      provinceId: parent.id,
    });
  }

  return provinces;
}

function build(overrides) {
  const provinces = buildAreas(overrides);
  return {
    mains: overrides.mains || seedMains(),
    subs: overrides.subs || BASE_SUBS.map((item) => ({ ...item })),
    skills: overrides.skills || BASE_SKILLS.map((item) => ({ ...item })),
    provinces,
  };
}

let overrides = { ...emptyOverrides(), ...(readSync() || {}) };
let view = build(overrides);
let revision = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  revision += 1;
  const raw = JSON.stringify(overrides);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, raw);
  } catch {
    // The in-memory list still updates for this visit.
  }
  AsyncStorage.setItem(KEY, raw).catch(() => {});
}

let hydrateStarted = false;

export function hydrateCatalog() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  const seen = revision;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw || seen !== revision) return;
      overrides = { ...emptyOverrides(), ...JSON.parse(raw) };
      view = build(overrides);
      emit();
    })
    .catch(() => {});
}

export function getCatalog() {
  return view;
}

export function subscribeCatalog(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCatalog() {
  const [, setVersion] = useState(0);
  useEffect(() => subscribeCatalog(() => setVersion((current) => current + 1)), []);
  return view;
}

function shown(status) {
  return status !== 'hide';
}

export function visibleMains(catalog = view) {
  return catalog.mains.filter((item) => shown(item.status));
}

export function visibleSubs(catalog = view) {
  const parents = new Set(visibleMains(catalog).map((item) => item.id));
  return catalog.subs.filter((item) => shown(item.status) && parents.has(item.parentId));
}

export function visibleSkills(catalog = view) {
  const parents = new Set(visibleMains(catalog).map((item) => item.id));
  return catalog.skills.filter((item) => shown(item.status) && parents.has(item.parentId));
}

export function visibleProvinces(catalog = view) {
  return catalog.provinces
    .filter((item) => shown(item.status))
    .map((item) => ({
      ...item,
      wards: item.wards.filter((ward) => shown(ward.status)),
    }));
}

export function homeCategories(catalog = view) {
  const visible = visibleMains(catalog);
  const original = new Set(BASE_CATEGORIES.map((item) => item.id));
  const popular = POPULAR_IDS.map((id) => visible.find((item) => item.id === id)).filter(Boolean);
  const added = visible.filter((item) => !original.has(item.id));
  return popular.concat(added);
}

export function countVisibleMains() {
  return visibleMains().length;
}

export function findCategory(id) {
  if (!id) return null;
  return (
    view.mains.find((item) => item.id === id) ||
    view.subs.find((item) => item.id === id) ||
    view.skills.find((item) => item.id === id) ||
    null
  );
}

function requireName(row, label) {
  const name = String(row.name || '').trim();
  if (!name) throw new Error(`Cần nhập ${label}.`);
  return name;
}

function requireParent(row, list) {
  if (!row.parentId || !list.some((item) => item.id === row.parentId)) {
    throw new Error('Cần chọn danh mục chính.');
  }
}

function ensureLists(next) {
  if (!next.mains) next.mains = seedMains();
  if (!next.subs) next.subs = BASE_SUBS.map((item) => ({ ...item }));
  if (!next.skills) next.skills = BASE_SKILLS.map((item) => ({ ...item }));
}

function statusOf(row) {
  return row.status === 'hide' ? 'hide' : 'show';
}

function mutateNamed(list, action, row, label) {
  if (action === 'create') {
    list.unshift({
      id: `${label}-${Date.now()}`,
      name: requireName(row, 'tên'),
      parentId: row.parentId,
      status: statusOf(row),
    });
    return list;
  }
  if (action === 'delete') return list.filter((item) => item.id !== row.id);
  return list.map((item) =>
    item.id === row.id
      ? { ...item, name: requireName(row, 'tên'), parentId: row.parentId, status: statusOf(row) }
      : item
  );
}

function isAddedProvince(next, id) {
  return (next.addedProvinces || []).some((item) => item.id === id);
}

function isAddedWard(next, id) {
  return (next.addedWards || []).some((item) => item.id === id);
}

function mutateAreas(next, action, row) {
  const kind = row.kind === 'ward' ? 'ward' : 'province';
  const name = action === 'delete' ? String(row.name || '').trim() : requireName(row, 'tên');
  const status = statusOf(row);

  if (action === 'create') {
    if (kind === 'province') {
      next.addedProvinces.push({ id: `tinh-${Date.now()}`, name, status });
      return;
    }
    if (!row.parentId) throw new Error('Cần chọn tỉnh/thành cho xã/phường.');
    next.addedWards.push({ id: `xa-${Date.now()}`, name, status, provinceId: row.parentId });
    return;
  }

  if (action === 'delete') {
    next.removed = [...(next.removed || []), row.id];
    if (kind === 'province') {
      const province = view.provinces.find((item) => item.id === row.id);
      if (province) next.removed.push(...province.wards.map((item) => item.id));
      next.addedWards = (next.addedWards || []).filter((item) => item.provinceId !== row.id);
    }
    next.addedProvinces = (next.addedProvinces || []).filter((item) => item.id !== row.id);
    next.addedWards = (next.addedWards || []).filter((item) => item.id !== row.id);
    return;
  }

  if (kind === 'province' && isAddedProvince(next, row.id)) {
    next.addedProvinces = next.addedProvinces.map((item) =>
      item.id === row.id ? { ...item, name, status } : item
    );
    return;
  }
  if (kind === 'ward' && isAddedWard(next, row.id)) {
    if (!row.parentId) throw new Error('Cần chọn tỉnh/thành cho xã/phường.');
    next.addedWards = next.addedWards.map((item) =>
      item.id === row.id ? { ...item, name, status, provinceId: row.parentId } : item
    );
    return;
  }
  if (kind === 'province') {
    next.provincePatches = { ...next.provincePatches, [row.id]: { name, status } };
    return;
  }
  if (!row.parentId) throw new Error('Cần chọn tỉnh/thành cho xã/phường.');
  const current = findBaseWard(row.id);
  const patch = { name, status };
  if (current && row.parentId !== current.provinceId) patch.provinceId = row.parentId;
  next.wardPatches = { ...next.wardPatches, [row.id]: { ...(next.wardPatches?.[row.id] || {}), ...patch } };
}

export function applyCatalogAdmin(pageId, action, row) {
  const next = {
    ...overrides,
    provincePatches: { ...(overrides.provincePatches || {}) },
    wardPatches: { ...(overrides.wardPatches || {}) },
    addedProvinces: [...(overrides.addedProvinces || [])],
    addedWards: [...(overrides.addedWards || [])],
    removed: [...(overrides.removed || [])],
  };
  ensureLists(next);

  let savedId = row.id || null;
  if (pageId === 'categories-main') {
    if (action === 'create') {
      savedId = row.id || `main-${Date.now()}`;
      next.mains.unshift({
        id: savedId,
        name: requireName(row, 'tên danh mục'),
        icon: row.icon || 'pricetag-outline',
        iconUrl: String(row.iconUrl || '').trim(),
        status: statusOf(row),
      });
    } else if (action === 'delete') {
      next.mains = next.mains.filter((item) => item.id !== row.id);
      next.subs = next.subs.filter((item) => item.parentId !== row.id);
      next.skills = next.skills.filter((item) => item.parentId !== row.id);
    } else {
      next.mains = next.mains.map((item) =>
        item.id === row.id
          ? {
              ...item,
              name: requireName(row, 'tên danh mục'),
              status: statusOf(row),
              iconUrl: row.iconUrl != null ? String(row.iconUrl).trim() : item.iconUrl || '',
            }
          : item
      );
    }
  } else if (pageId === 'categories-sub') {
    if (action !== 'delete') requireParent(row, next.mains);
    next.subs = mutateNamed(next.subs, action, row, 'sub');
  } else if (pageId === 'categories-skills') {
    if (action !== 'delete') requireParent(row, next.mains);
    next.skills = mutateNamed(next.skills, action, row, 'skill');
  } else if (pageId === 'categories-areas') {
    mutateAreas(next, action, row);
  }

  overrides = next;
  view = build(overrides);
  persist();
  emit();
  return savedId;
}

export function replaceCatalogMains(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  overrides = {
    ...overrides,
    mains: rows.map((row) => ({
      id: row.id,
      name: row.name || 'Danh mục',
      icon: row.icon || 'pricetag-outline',
      iconUrl: row.iconUrl || row.icon_url || '',
      status: row.status === 'hide' || row.status === 'an' ? 'hide' : 'show',
    })),
  };
  view = build(overrides);
  persist();
  emit();
}

export function catalogRows(pageId, catalog = view) {
  if (pageId === 'categories-main') {
    return catalog.mains.map((item) => ({
      id: item.id,
      name: item.name,
      icon: item.icon || 'pricetag-outline',
      iconUrl: item.iconUrl || '',
      status: item.status,
    }));
  }
  if (pageId === 'categories-sub') {
    return catalog.subs.map((item) => ({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      status: item.status,
    }));
  }
  if (pageId === 'categories-skills') {
    return catalog.skills.map((item) => ({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      status: item.status,
    }));
  }
  if (pageId === 'categories-areas') {
    const provinces = catalog.provinces.map((item) => ({
      id: item.id,
      kind: 'province',
      name: item.name,
      parentId: '',
      status: item.status,
    }));
    const wards = catalog.provinces.flatMap((province) =>
      province.wards.map((ward) => ({
        id: ward.id,
        kind: 'ward',
        name: ward.name,
        parentId: province.id,
        status: ward.status,
      }))
    );
    return provinces.concat(wards);
  }
  return null;
}

export function withCatalogFields(page, catalog = view) {
  if (!page?.fields) return page;
  const mainOptions = catalog.mains.map((item) => ({
    value: item.id,
    label: item.status === 'hide' ? `${item.name} (đang ẩn)` : item.name,
  }));
  const provinceOptions = catalog.provinces.map((item) => ({
    value: item.id,
    label: item.status === 'hide' ? `${item.name} (đang ẩn)` : item.name,
  }));
  const fields = page.fields.map((field) => {
    if ((page.id === 'categories-sub' || page.id === 'categories-skills') && field.key === 'parentId') {
      return { ...field, options: mainOptions };
    }
    if (page.id === 'categories-areas' && field.key === 'parentId') {
      return { ...field, options: provinceOptions };
    }
    if (field.key === 'categoryId') {
      return { ...field, options: mainOptions.filter((item) => !item.label.endsWith('(đang ẩn)')) };
    }
    return field;
  });
  return { ...page, fields };
}
