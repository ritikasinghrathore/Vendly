import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';

export default function CustomerTabs() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  if (!user) return null; // signing out: nothing to show
  const icon = (name: React.ComponentProps<typeof Feather>['name']) =>
    ({ color, size }: { color: string; size: number }) => <Feather name={name} color={color} size={size} />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.plum,
      tabBarInactiveTintColor: C.inkSoft,
      tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line, borderTopWidth: 1.5, height: 62 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 4 },
      tabBarLabelStyle: { fontFamily: F.bodyBold, fontSize: 11 },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Shops', tabBarIcon: icon('shopping-bag') }} />
      <Tabs.Screen name="search" options={{ title: 'Compare', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="lists" options={{ title: 'My lists', tabBarIcon: icon('clipboard') }} />
      <Tabs.Screen name="khata" options={{ title: 'Khata', tabBarIcon: icon('book-open') }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
