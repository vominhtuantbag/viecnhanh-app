import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import AdminCrudPanel from '@/components/AdminCrudPanel';
import AdminNotificationBoard from '@/components/AdminNotificationBoard';
import AdminSidebar from '@/components/AdminSidebar';
import AdminUserBoard from '@/components/AdminUserBoard';
import AdminWorkBoard from '@/components/AdminWorkBoard';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { findAdminPage, mergeLiveAdminData, replaceAdminUsers, seedAdminStores } from '@/data/adminMenu';
import {
  fetchAdminRewardClaims,
  fetchAdminRewardTasks,
  fetchAdminRewards,
  saveRewardAdmin,
} from '@/services/rewards';
import { applyCatalogAdmin, catalogRows, replaceCatalogMains, useCatalog, withCatalogFields } from '@/data/catalog';
import {
  fetchAdminBanners,
  fetchAdminMainCategories,
  fetchAdminNotificationTemplates,
  saveBanner,
  saveMainCategory,
  saveNotificationTemplate,
} from '@/services/homeContent';
import {
  adminCreateUser,
  fetchAdminBids,
  fetchAdminChats,
  fetchAdminJobs,
  fetchAdminReviews,
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminVouchers,
  syncAdminChange,
} from '@/services/admin';

const GREEN = '#16A34A';
const USER_LISTS = ['users-list', 'users-verify', 'users-all', 'users-workers', 'users-posters', 'admins-list', 'users-create'];

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const { session, profile, signInWithPhone, loading } = useAuth();
  const [pageId, setPageId] = useState('dashboard');
  const [openIds, setOpenIds] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [stores, setStores] = useState(seedAdminStores);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const liveReady = useRef(false);

  const catalog = useCatalog();
  const page = withCatalogFields(findAdminPage(pageId), catalog);
  const catalogList = catalogRows(pageId, catalog);

  const load = useCallback(async () => {
    if (!profile?.is_admin) return;
    setError('');
    try {
      const [nextStats, nextJobs, nextUsers, nextBids, nextVouchers, nextReviews, nextChats, rewardTasks, rewardItems, rewardClaims] = await Promise.all([
        fetchAdminStats(),
        fetchAdminJobs(),
        fetchAdminUsers(),
        fetchAdminBids(),
        fetchAdminVouchers(),
        fetchAdminReviews(),
        fetchAdminChats(),
        fetchAdminRewardTasks(),
        fetchAdminRewards(),
        fetchAdminRewardClaims(),
      ]);
      const [bannerRows, categoryRows, templateRows] = await Promise.all([
        fetchAdminBanners(),
        fetchAdminMainCategories(),
        fetchAdminNotificationTemplates(),
      ]);
      if (categoryRows?.length) replaceCatalogMains(categoryRows);
      setStats(nextStats);
      setStores((prev) => {
        const base = liveReady.current
          ? prev
          : mergeLiveAdminData(prev, {
              jobs: nextJobs,
              users: nextUsers,
              bids: nextBids,
              vouchers: nextVouchers,
              reviews: nextReviews,
              chats: nextChats,
            });
        liveReady.current = true;
        const next = replaceAdminUsers(base, nextUsers);
        if (rewardTasks) next['quests-tasks'] = rewardTasks;
        if (rewardItems) next['quests-rewards'] = rewardItems;
        if (rewardClaims) next['quests-history'] = rewardClaims;
        if (bannerRows) next['extras-banners'] = bannerRows;
        if (templateRows) next['notifications-templates'] = templateRows;
        return next;
      });
    } catch (err) {
      setError(err.message ?? 'Không tải được dữ liệu quản trị.');
    }
  }, [profile?.is_admin]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  const maxTrend = useMemo(
    () => Math.max(1, ...(stats?.trend || []).map((item) => item.count)),
    [stats]
  );

  const toggleGroup = (id) => {
    setOpenIds((current) => (current[0] === id ? [] : [id]));
  };

  const commit = async (action, row) => {
    const target = findAdminPage(pageId);
    setError('');
    if (pageId === 'notifications-templates') {
      try {
        await saveNotificationTemplate(action, row);
        const fresh = await fetchAdminNotificationTemplates();
        if (fresh) setStores((prev) => ({ ...prev, 'notifications-templates': fresh }));
      } catch (err) {
        const message = err.message || 'Không lưu được mẫu thông báo.';
        const offline = /migrate_home_feed|chưa có mẫu/i.test(message);
        if (offline) {
          setStores((prev) => {
            const list = prev['notifications-templates'] || [];
            if (action === 'delete') {
              return { ...prev, 'notifications-templates': list.filter((item) => item.id !== row.id) };
            }
            if (action === 'create') {
              return { ...prev, 'notifications-templates': [{ ...row, id: `tip-${Date.now()}` }, ...list] };
            }
            return {
              ...prev,
              'notifications-templates': list.map((item) => (item.id === row.id ? { ...item, ...row } : item)),
            };
          });
        }
        setError(message);
        if (!offline) throw err;
      }
      return;
    }
    if (pageId === 'extras-banners') {
      try {
        await saveBanner(action, row);
        const fresh = await fetchAdminBanners();
        if (fresh) setStores((prev) => ({ ...prev, 'extras-banners': fresh }));
      } catch (err) {
        const message = err.message || 'Không lưu được banner.';
        const offline = /migrate_home_content|chưa có banner/i.test(message);
        if (offline) {
          setStores((prev) => {
            const list = prev['extras-banners'] || [];
            if (action === 'delete') return { ...prev, 'extras-banners': list.filter((item) => item.id !== row.id) };
            if (action === 'create') return { ...prev, 'extras-banners': [{ ...row, id: `banner-${Date.now()}` }, ...list] };
            return { ...prev, 'extras-banners': list.map((item) => (item.id === row.id ? { ...item, ...row } : item)) };
          });
        }
        setError(message);
        if (!offline) throw err;
      }
      return;
    }
    if (catalogRows(pageId)) {
      try {
        if (pageId === 'categories-main') {
          const id = action === 'create' ? row.id || `main-${Date.now()}` : row.id;
          const nextRow = { ...row, id };
          try {
            await saveMainCategory(action, nextRow);
          } catch (err) {
            const message = err.message || '';
            if (!/migrate_home_content|chưa có banner/i.test(message)) throw err;
            applyCatalogAdmin(pageId, action, nextRow);
            setError(message);
            return;
          }
          applyCatalogAdmin(pageId, action, nextRow);
        } else {
          applyCatalogAdmin(pageId, action, row);
        }
      } catch (err) {
        const message = err.message || 'Không lưu được.';
        setError(message);
        throw err;
      }
      return;
    }
    if (target.live === 'reward-tasks' || target.live === 'rewards' || target.live === 'reward-claims') {
      try {
        await saveRewardAdmin(target.live, action, row);
        const [rewardTasks, rewardItems, rewardClaims] = await Promise.all([
          fetchAdminRewardTasks(),
          fetchAdminRewards(),
          fetchAdminRewardClaims(),
        ]);
        setStores((prev) => {
          const next = { ...prev };
          if (rewardTasks) next['quests-tasks'] = rewardTasks;
          if (rewardItems) next['quests-rewards'] = rewardItems;
          if (rewardClaims) next['quests-history'] = rewardClaims;
          return next;
        });
      } catch (err) {
        const message = err.message || 'Không lưu được nhiệm vụ hoặc quà.';
        setError(message);
        throw err;
      }
      return;
    }
    if (target.live === 'users' && action === 'create') {
      try {
        await adminCreateUser(row);
        const fresh = await fetchAdminUsers();
        setStores((prev) => replaceAdminUsers(prev, fresh));
      } catch (err) {
        const message = err.message || 'Không tạo được tài khoản.';
        setError(message);
        throw err;
      }
      return;
    }
    setStores((prev) => {
      if (target.live === 'users') {
        const next = { ...prev };
        if (action === 'delete') {
          for (const key of USER_LISTS) {
            next[key] = (next[key] || []).filter((item) => item.id !== row.id);
          }
          return next;
        }
        for (const key of USER_LISTS) {
          next[key] = (next[key] || []).map((item) => (item.id === row.id ? { ...item, ...row } : item));
        }
        return next;
      }
      const list = prev[pageId] || [];
      if (action === 'delete') {
        return { ...prev, [pageId]: list.filter((item) => item.id !== row.id) };
      }
      if (action === 'create') {
        return { ...prev, [pageId]: [{ ...row, id: `moi-${Date.now()}` }, ...list] };
      }
      return {
        ...prev,
        [pageId]: list.map((item) => (item.id === row.id ? { ...item, ...row } : item)),
      };
    });
    try {
      await syncAdminChange(target, action, row);
    } catch (err) {
      const message = err.message || 'Đã lưu trên màn hình. Máy chủ chưa nhận thay đổi này.';
      setError(message);
      throw err;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GREEN} />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.loginSafe}>
        <View style={styles.loginCard}>
        <Text style={styles.loginTitle}>Đăng nhập quản trị</Text>
        <Text style={styles.loginHint}>Dùng số điện thoại và mật khẩu của tài khoản được cấp quyền quản trị.</Text>
        <TextInput style={styles.input} placeholder="Số điện thoại" value={phone} onChangeText={setPhone} />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={styles.loginBtn}
          onPress={async () => {
            setError('');
            try {
              await signInWithPhone({ phone, password });
            } catch (err) {
              setError(err.message ?? 'Đăng nhập thất bại.');
            }
          }}>
          <Text style={styles.loginBtnText}>Vào bảng điều khiển</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/landing')}>
          <Text style={styles.back}>← Về trang giới thiệu</Text>
        </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile?.is_admin) {
    return (
      <SafeAreaView style={styles.loginSafe}>
        <View style={styles.loginCard}>
        <Text style={styles.loginTitle}>Chưa có quyền quản trị</Text>
        <Text style={styles.loginHint}>
          Tài khoản này chưa được mở khu vực quản trị. Cần bật quyền quản trị cho số điện thoại đang đăng nhập.
        </Text>
        <Pressable onPress={() => router.replace('/(tabs)/account')}>
          <Text style={styles.back}>← Về tài khoản</Text>
        </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const showMenu = !compact || menuOpen;

  return (
    <View style={styles.shell}>
      {compact && menuOpen ? <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} /> : null}
      {showMenu ? (
        <AdminSidebar
          pageId={pageId}
          openIds={openIds}
          onToggle={toggleGroup}
          onSelect={(id) => {
            setPageId(id);
            setMenuOpen(false);
            if (id !== 'dashboard') {
              const next = findAdminPage(id);
              if (next.parentId) setOpenIds([next.parentId]);
            } else {
              setOpenIds([]);
            }
          }}
          floating={compact}
        />
      ) : null}

      <View style={[styles.main, compact && styles.mainCompact]}>
        {compact ? (
          <Pressable style={styles.menuBtn} onPress={() => setMenuOpen(true)}>
            <Ionicons name="menu" size={18} color="#0F172A" />
            <Text style={styles.menuBtnText}>Mở menu</Text>
          </Pressable>
        ) : null}

        {pageId === 'dashboard' || page.board === 'create' ? (
          <Text style={[styles.h1, compact && styles.h1Compact]}>{page.label}</Text>
        ) : null}
        {page.parentLabel ? <Text style={styles.crumb}>{page.parentLabel}</Text> : null}
        {pageId === 'dashboard' ? (
          <Text style={styles.sub}>Tổng quan hiệu suất nền tảng Việc Nhanh</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {pageId === 'dashboard' && stats ? (
          <ScrollView style={styles.boardSlot} contentContainerStyle={styles.dashScroll}>
            <View style={styles.cards}>
              <Stat title="Tổng người dùng" value={stats.totalUsers} icon="people" full={compact} />
              <Stat title="Người dùng hoạt động" value={stats.activeUsers} icon="pulse" full={compact} />
              <Stat title="Tổng việc" value={stats.totalJobs} icon="briefcase" full={compact} />
              <Stat title="Việc đang mở" value={stats.openJobs} icon="folder-open" full={compact} />
              <Stat title="Tổng đề xuất" value={stats.totalBids} icon="pricetags" full={compact} />
              <Stat title="Đề xuất chờ" value={stats.pendingBids} icon="time" full={compact} />
              <Stat title="Danh mục" value={stats.totalCategories} icon="grid" full={compact} />
              <Stat title="Tin chờ duyệt" value={stats.pendingJobs} icon="alert-circle" full={compact} />
            </View>
            <View style={styles.charts}>
              <View style={[styles.chartCard, compact && styles.chartCardCompact]}>
                <Text style={styles.chartTitle}>Xu hướng đăng việc (10 ngày)</Text>
                <View style={styles.bars}>
                  {(stats.trend || []).map((item) => (
                    <View key={item.key} style={styles.barCol}>
                      <View style={[styles.bar, { height: 8 + (item.count / maxTrend) * 110 }]} />
                      <Text style={styles.barLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.chartCard, compact && styles.chartCardCompact]}>
                <Text style={styles.chartTitle}>Phân bố trạng thái việc</Text>
                <Legend color={GREEN} label={`Đang mở ${stats.byStatus.open}`} />
                <Legend color="#6366F1" label={`Đã nhận ${stats.byStatus.assigned}`} />
                <Legend color="#0EA5E9" label={`Hoàn thành ${stats.byStatus.completed}`} />
                <Legend color="#F43F5E" label={`Đã đóng ${stats.byStatus.cancelled}`} />
                <Legend color="#F59E0B" label={`Chờ duyệt ${stats.byStatus.pending}`} />
                <Text style={styles.donutNum}>{stats.totalJobs}</Text>
                <Text style={styles.donutCap}>tổng việc</Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.boardSlot}>
            {page.board === 'users' || page.board === 'verify' || page.board === 'create' ? (
              <AdminUserBoard page={page} rows={stores[pageId] || []} onCommit={commit} compact={compact} />
            ) : page.board === 'campaigns' ? (
              <AdminNotificationBoard people={stores['users-list'] || []} compact={compact} />
            ) : page.board ? (
              <AdminWorkBoard
                page={page}
                rows={stores[pageId] || []}
                people={stores['users-list'] || stores['users-all'] || []}
                onCommit={commit}
                compact={compact}
              />
            ) : page.fields ? (
              <AdminCrudPanel key={page.id} page={page} rows={catalogList || stores[pageId] || []} onCommit={commit} />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ title, value, icon, full }) {
  return (
    <View style={[styles.stat, full && styles.statFull]}>
      <View>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={GREEN} />
      </View>
    </View>
  );
}

function Legend({ color, label }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F4F6F8',
    ...(Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh' } : null),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    zIndex: 10,
  },
  main: { flex: 1, minWidth: 0, padding: 20, paddingBottom: 16 },
  mainCompact: { padding: 14, paddingBottom: 12 },
  boardSlot: { flex: 1, minHeight: 0 },
  dashScroll: { paddingBottom: 32 },
  menuBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  menuBtnText: { fontWeight: '800', color: '#0F172A' },
  h1: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  h1Compact: { fontSize: 22 },
  crumb: { color: '#94A3B8', fontWeight: '700', marginBottom: 4 },
  sub: { color: '#64748B', marginBottom: 16 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    width: 240,
    minWidth: 200,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  statFull: { width: '100%', minWidth: 0, flexBasis: '100%' },
  statLabel: { color: '#64748B', fontWeight: '700', fontSize: 12 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  chartCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  chartCardCompact: { minWidth: 0, width: '100%', flexBasis: '100%' },
  chartTitle: { fontWeight: '800', marginBottom: 12, color: '#0F172A' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 140 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', backgroundColor: '#93C5FD', borderRadius: 8 },
  barLabel: { fontSize: 9, color: '#94A3B8', marginTop: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#475569', fontSize: 13 },
  donutNum: { fontSize: 36, fontWeight: '800', color: GREEN, marginTop: 12 },
  donutCap: { color: '#64748B' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loginSafe: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loginCard: { width: '100%', maxWidth: 420, gap: 10 },
  loginTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  loginHint: { color: '#64748B', marginBottom: 8, lineHeight: 20 },
  loginBtn: {
    backgroundColor: Colors.primary,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: { color: '#FFFFFF', fontWeight: '800' },
  back: { color: Colors.primary, fontWeight: '700', marginTop: 8 },
  error: { color: '#DC2626', marginBottom: 8 },
});
