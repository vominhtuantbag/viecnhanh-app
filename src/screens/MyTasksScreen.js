import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountBadge } from '@/components/CountBadge';
import { FilterSelect } from '@/components/FilterSelect';
import { TaskCard } from '@/components/TaskCard';
import { Colors, Radius } from '@/constants/colors';
import { useJobs } from '@/context/JobsContext';
import { useUnread } from '@/context/UnreadContext';
import { JOB_STATUS, jobFlowStatus } from '@/data/jobs';

const TABS = [
  { id: 'posted', label: 'Đã đăng' },
  { id: 'received', label: 'Đã nhận' },
  { id: 'cancelled', label: 'Đã huỷ' },
];

const FILTERS = {
  posted: [
    { id: 'newest', name: 'Mới nhất' },
    { id: 'oldest', name: 'Cũ nhất' },
    { id: 'open', name: 'Đang mở' },
    { id: 'pending', name: 'Đang chờ duyệt' },
    { id: 'paid', name: 'Đã thanh toán' },
  ],
  received: [
    { id: 'newest', name: 'Mới nhất' },
    { id: 'oldest', name: 'Cũ nhất' },
    { id: 'proposed', name: 'Đã gửi đề xuất' },
    { id: 'hired', name: 'Đã được thuê' },
    { id: 'completed', name: 'Đã hoàn thành' },
  ],
  cancelled: [
    { id: 'newest', name: 'Mới nhất' },
    { id: 'oldest', name: 'Cũ nhất' },
  ],
};

const STATUS_KEYS = {
  posted: new Set(['open', 'pending', 'paid']),
  received: new Set(['proposed', 'hired', 'completed']),
};

function myQuote(job, profileId) {
  if (!profileId) return null;
  return (job.quotes || []).find((quote) => quote.workerId === profileId) || null;
}

function sortByTime(list, timeSort) {
  const copy = [...list];
  copy.sort((a, b) => {
    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return timeSort === 'oldest' ? left - right : right - left;
  });
  return copy;
}

function postedKind(job) {
  const status = jobFlowStatus(job);
  if (status === JOB_STATUS.PENDING) return 'pending';
  if (status === JOB_STATUS.APPROVED) return 'open';
  if (status === JOB_STATUS.COMPLETED) return 'paid';
  if (status === JOB_STATUS.ASSIGNED) return 'assigned';
  return null;
}

function receivedKind(job, profileId) {
  const quote = myQuote(job, profileId);
  if (!quote || quote.status === 'cancelled') return null;
  const status = jobFlowStatus(job);
  const hired = Boolean(job.hiredWorkerId === profileId);
  if (status === JOB_STATUS.COMPLETED && hired) return 'completed';
  if (status === JOB_STATUS.ASSIGNED && hired) return 'hired';
  if (status !== JOB_STATUS.CLOSED) return 'proposed';
  return null;
}

function cancelledKind(job, profileId) {
  if (job.isMine && jobFlowStatus(job) === JOB_STATUS.CLOSED) return 'deleted';
  const quote = myQuote(job, profileId);
  if (quote?.status === 'cancelled') return 'hire_cancelled';
  if (!job.isMine && quote && jobFlowStatus(job) === JOB_STATUS.CLOSED) return 'deleted';
  return null;
}

function badgeFor(tab, kind) {
  if (tab === 'posted') {
    if (kind === 'pending') return { label: 'Chờ duyệt', status: JOB_STATUS.PENDING };
    if (kind === 'open') return { label: 'Đang mở', status: JOB_STATUS.APPROVED };
    if (kind === 'paid') return { label: 'Đã thanh toán', status: JOB_STATUS.COMPLETED };
    if (kind === 'assigned') return { label: 'Đã thuê', status: JOB_STATUS.ASSIGNED };
  }
  if (tab === 'received') {
    if (kind === 'proposed') return { label: 'Đã gửi đề xuất', status: JOB_STATUS.APPROVED };
    if (kind === 'hired') return { label: 'Đã được thuê', status: JOB_STATUS.ASSIGNED };
    if (kind === 'completed') return { label: 'Hoàn thành', status: JOB_STATUS.COMPLETED };
  }
  if (kind === 'deleted') return { label: 'Đã xoá', status: JOB_STATUS.CLOSED };
  if (kind === 'hire_cancelled') return { label: 'Chủ đã huỷ thuê', status: JOB_STATUS.CLOSED };
  return { label: null, status: null };
}

export default function MyTasksScreen() {
  const { jobs, profile } = useJobs();
  const { bidUnreadTotal } = useUnread();
  const [tab, setTab] = useState('posted');
  const [filters, setFilters] = useState({
    posted: 'newest',
    received: 'newest',
    cancelled: 'newest',
  });

  const filterValue = filters[tab];
  const timeSort = filterValue === 'oldest' ? 'oldest' : 'newest';
  const statusFilter = STATUS_KEYS[tab]?.has(filterValue) ? filterValue : null;

  const data = useMemo(() => {
    const profileId = profile?.id;
    const rows = [];

    for (const job of jobs) {
      if (tab === 'posted') {
        if (!job.isMine) continue;
        const kind = postedKind(job);
        if (!kind) continue;
        if (statusFilter && kind !== statusFilter) continue;
        rows.push({ job, kind });
        continue;
      }

      if (tab === 'received') {
        const kind = receivedKind(job, profileId);
        if (!kind) continue;
        if (statusFilter && kind !== statusFilter) continue;
        rows.push({ job, kind });
        continue;
      }

      const kind = cancelledKind(job, profileId);
      if (kind) rows.push({ job, kind });
    }

    return sortByTime(rows, timeSort);
  }, [jobs, profile, statusFilter, tab, timeSort]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Việc của tôi</Text>
      <View style={styles.toolbar}>
        <View style={styles.tabsSlot}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabs}>
            {TABS.map((item) => {
              const active = item.id === tab;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  style={[styles.tab, active && styles.tabActive]}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.id === 'posted' ? <CountBadge count={bidUnreadTotal} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={styles.filterSlot}>
          <FilterSelect
            compact
            label="Lọc"
            value={filterValue}
            options={FILTERS[tab]}
            onChange={(next) => setFilters((current) => ({ ...current, [tab]: next }))}
          />
        </View>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => `${tab}-${item.kind}-${item.job.id}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có việc trong mục này.</Text>}
        renderItem={({ item }) => {
          const badge = badgeFor(tab, item.kind);
          return (
            <TaskCard job={item.job} badgeLabel={badge.label} badgeStatus={badge.status} />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    paddingHorizontal: 12,
    paddingTop: 8,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? {
          position: 'sticky',
          top: 0,
        }
      : null),
  },
  tabsSlot: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  tabsScroll: {
    flexGrow: 1,
  },
  filterSlot: {
    flexShrink: 0,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  tab: {
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  gap: {
    height: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: Colors.textMuted,
  },
});
