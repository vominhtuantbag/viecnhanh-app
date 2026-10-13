import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { Colors } from '@/constants/colors';
import { useJobs } from '@/context/JobsContext';
import { useUnread } from '@/context/UnreadContext';
import { badgeLabel } from '@/services/unread';

function TabIcon({ name, color, focused }) {
  return <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />;
}

const badgeStyle = {
  backgroundColor: '#D92D20',
  color: '#FFFFFF',
  fontSize: 10,
  fontWeight: '800',
};

export default function TabsLayout() {
  const { messageUnreadTotal, bidUnreadTotal } = useUnread();
  const { newJobsCount } = useJobs();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 68,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarBadgeStyle: badgeStyle,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Nhờ làm việc',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="add-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Khám phá',
          tabBarBadge: badgeLabel(newJobsCount),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-tasks"
        options={{
          title: 'Việc của tôi',
          tabBarBadge: badgeLabel(bidUnreadTotal),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="checkbox" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Tin nhắn',
          tabBarBadge: badgeLabel(messageUnreadTotal),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubble" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
