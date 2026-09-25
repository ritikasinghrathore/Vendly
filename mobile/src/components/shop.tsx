import React from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { IconBtn } from './ui';
import { C, F } from '../theme';
import { useUnread } from '../lib/hooks';
import type { Shop } from '../lib/types';

export function ShopAvatar({ shop, size = 64 }: { shop: Pick<Shop, 'name' | 'logo_url'>; size?: number }) {
  if (shop.logo_url) {
    return <Image source={{ uri: shop.logo_url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.white }} accessibilityLabel={`${shop.name} logo`} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.display, fontSize: size * 0.6, lineHeight: size * 0.85, color: C.plum }}>{shop.name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Bell() {
  const router = useRouter();
  const { count } = useUnread();
  return <IconBtn name="bell" label="Notifications" badge={count} onPress={() => router.push('/notifications')} />;
}
