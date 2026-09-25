import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Empty, ErrorBox, Header, Loading, Petal, Screen } from '../src/components/ui';
import { C, T, pastelFor } from '../src/theme';
import { useAuth } from '../src/lib/auth';
import { useLoad } from '../src/lib/hooks';
import { formatWhen } from '../src/lib/format';
import * as api from '../src/lib/api';
import type { AppNotification } from '../src/lib/types';

export default function Notifications() {
  const { user } = useAuth();
  const router = useRouter();
  const q = useLoad(() => api.listNotifications(), []);
  const items = q.data ?? [];

  // Clear the red badge once the list has been shown (the unread dots stay for this visit).
  useEffect(() => { if (q.data && q.data.some((n) => !n.read_at)) api.markAllRead().catch(() => {}); }, [q.data]);

  function open(n: AppNotification) {
    const d = n.data ?? {};
    if (n.type === 'list') router.push(user?.role === 'shopkeeper' ? '/incoming' : `/list/${d.list_id}`);
    else if (n.type === 'bill' && d.bill_id) router.push(`/bill/${d.bill_id}`);
    else if (n.type === 'payment' && d.shop_customer_id) router.push(`/ledger/${d.shop_customer_id}`);
    else if (n.type === 'low_stock' && d.product_id) router.push(`/product/edit?id=${d.product_id}`);
  }

  return (
    <Screen edges={['top', 'bottom']} onRefresh={q.pull} refreshing={q.refreshing}>
      <Header title="Notifications" back animate />
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : items.length === 0 ? (
        <Empty title="All quiet" text="Bills, payments and shopping lists will show up here." />
      ) : items.map((n, i) => (
        <Pressable key={n.id} onPress={() => open(n)} accessibilityRole="button" style={{ marginBottom: 10 }}>
          <Petal color={n.read_at ? C.white : pastelFor(n.type)} flip={i % 2 === 1} style={{ borderWidth: n.read_at ? 1.5 : 0, borderColor: C.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!n.read_at ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.plum }} /> : null}
              <Text style={T.h3}>{n.title}</Text>
            </View>
            {n.body ? <Text style={[T.body, { marginTop: 2 }]}>{n.body}</Text> : null}
            <Text style={[T.small, { marginTop: 4 }]}>{formatWhen(n.created_at)}</Text>
          </Petal>
        </Pressable>
      ))}
    </Screen>
  );
}
