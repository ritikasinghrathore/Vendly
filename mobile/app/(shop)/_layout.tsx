import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';

export default function ShopTabs() {
  const insets = useSafeAreaInsets();
  const { activeShop } = useAuth();
  if (!activeShop) return null; // signing out: nothing to show
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
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="incoming" options={{ title: 'Lists', tabBarIcon: icon('inbox') }} />
      <Tabs.Screen name="billing" options={{ title: 'Bill', tabBarIcon: icon('file-text') }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: icon('package') }} />
      <Tabs.Screen name="customers" options={{ title: 'Khata', tabBarIcon: icon('book-open') }} />
    </Tabs>
  );
}
