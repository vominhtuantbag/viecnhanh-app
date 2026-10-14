import { supabase } from '@/lib/supabase';

const MISSING = /banners|danh_muc_chinh|schema cache|PGRST205|42P01|42703/i;

export const FALLBACK_BANNERS = [
  {
    id: 'fallback-clean',
    title: 'Việc nhà cuối tuần',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
    link: '/create',
  },
  {
    id: 'fallback-tools',
    title: 'Thợ gần bạn, báo giá nhanh',
    imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80',
    link: '/browse',
  },
  {
    id: 'fallback-kitchen',
    title: 'Đổi quà sau khi xong việc',
    imageUrl: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80',
    link: '/rewards',
  },
];

export function friendlyHomeError(error) {
  const message = error?.message || (typeof error === 'string' ? error : '');
  if (MISSING.test(message)) {
    return 'Máy chủ chưa có banner và icon danh mục. Mở Supabase → SQL Editor, dán file supabase/migrate_home_content.sql rồi bấm Run.';
  }
  return message || 'Không lưu được. Thử lại sau.';
}

function shown(row) {
  if (row?.is_active === false) return false;
  const status = String(row?.status || 'show');
  return status === 'show' || status === 'hien' || status === 'on';
}

function mapBanner(row) {
  return {
    id: row.id,
    title: row.title || '',
    imageUrl: row.image_url || '',
    link: row.link || '',
    status: row.status === 'hide' || row.status === 'an' ? 'hide' : 'show',
  };
}

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name || '',
    icon: row.icon || 'pricetag-outline',
    iconUrl: row.icon_url || '',
    status: row.status === 'hide' || row.status === 'an' ? 'hide' : 'show',
  };
}

async function selectBanners() {
  const rich = await supabase
    .from('banners')
    .select('id, title, image_url, link, status, is_active, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (!rich.error) return rich;
  return supabase
    .from('banners')
    .select('id, title, image_url, link, status, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
}

async function selectCategories() {
  const rich = await supabase
    .from('danh_muc_chinh')
    .select('id, name, icon, icon_url, status, is_active, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (!rich.error) return rich;
  return supabase
    .from('danh_muc_chinh')
    .select('id, name, icon, icon_url, status, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
}

export async function fetchHomeBanners() {
  const result = await selectBanners();
  if (result.error) return FALLBACK_BANNERS;
  const rows = (result.data || []).filter(shown).map(mapBanner).slice(0, 3);
  return rows.length ? rows : FALLBACK_BANNERS;
}

export async function fetchActiveMainCategories() {
  const result = await selectCategories();
  if (result.error) return null;
  return (result.data || []).filter(shown).map(mapCategory);
}

export async function fetchAdminBanners() {
  const result = await selectBanners();
  if (result.error) return null;
  return (result.data || []).map(mapBanner);
}

export async function fetchAdminMainCategories() {
  const result = await selectCategories();
  if (result.error) return null;
  return (result.data || []).map(mapCategory);
}

function bannerPayload(row) {
  const title = String(row.title || '').trim();
  if (!title) throw new Error('Cần nhập tiêu đề banner.');
  const imageUrl = String(row.imageUrl || '').trim();
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
    throw new Error('Ảnh banner cần là đường dẫn bắt đầu bằng https://');
  }
  return {
    title,
    image_url: imageUrl || null,
    link: String(row.link || '').trim() || null,
    status: row.status === 'hide' ? 'hide' : 'show',
  };
}

export async function saveBanner(action, row) {
  if (action === 'delete') {
    const result = await supabase.from('banners').delete().eq('id', row.id);
    if (result.error) throw new Error(friendlyHomeError(result.error));
    return null;
  }
  const payload = bannerPayload(row);
  const existing = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(row.id || ''));
  const result = existing
    ? await supabase.from('banners').update(payload).eq('id', row.id).select('id').single()
    : await supabase.from('banners').insert(payload).select('id').single();
  if (result.error) throw new Error(friendlyHomeError(result.error));
  return result.data;
}

export async function saveMainCategory(action, row) {
  if (action === 'delete') {
    const result = await supabase.from('danh_muc_chinh').delete().eq('id', row.id);
    if (result.error) throw new Error(friendlyHomeError(result.error));
    return null;
  }
  const name = String(row.name || '').trim();
  if (!name) throw new Error('Cần nhập tên danh mục.');
  const iconUrl = String(row.iconUrl || '').trim();
  if (iconUrl && !/^https:\/\//i.test(iconUrl)) {
    throw new Error('Icon cần là đường dẫn bắt đầu bằng https://');
  }
  const id = String(row.id || `main-${Date.now()}`);
  const result = await supabase.from('danh_muc_chinh').upsert(
    {
      id,
      name,
      icon: row.icon || 'pricetag-outline',
      icon_url: iconUrl || null,
      status: row.status === 'hide' ? 'hide' : 'show',
    },
    { onConflict: 'id' }
  );
  if (result.error) throw new Error(friendlyHomeError(result.error));
  return id;
}

export async function uploadPublicImage(bucket, file) {
  if (!file) throw new Error('Chưa chọn ảnh.');
  const limit = bucket === 'category-icons' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > limit) {
    throw new Error(bucket === 'category-icons' ? 'Icon cần nhỏ hơn 2 MB.' : 'Ảnh cần nhỏ hơn 5 MB.');
  }
  const ext =
    String(file.name || 'anh.jpg')
      .split('.')
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const result = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (result.error) {
    throw new Error(result.error.message || 'Không tải được ảnh. Bạn có thể dán đường dẫn https://.');
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Không lấy được đường dẫn ảnh.');
  return data.publicUrl;
}
