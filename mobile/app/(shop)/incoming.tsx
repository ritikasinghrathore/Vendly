import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Btn, Empty, ErrorBox, Loading, Petal, Screen } from '../../src/components/ui';
import { Typewriter } from '../../src/components/motion';
import { Bell } from '../../src/components/shop';
import { C, F, T, pastelFor } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { UNIT_LABEL, formatQty, formatWhen } from '../../src/lib/format';
import * as api from '../../src/lib/api';

export default function Incoming() {
  const { activeShop } = useAuth();
  const shop = activeShop!;
  const router = useRouter();
  const q = useLoad(() => api.incomingLists(shop.id), [shop.id]);
  const [open, setOpen] = useState<string | null>(null);
  const lists = q.data ?? [];

  async function view(id: string, status: string) {
    setOpen(open === id ? null : id);
    if (open !== id && status === 'submitted') {
      try { await api.markViewed(shop.id, id); q.reload(); } catch (e: any) { Alert.alert('Could not open', e.message); }
    }
  }

  return (
    <Screen onRefresh={q.pull} refreshing={q.refreshing}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Typewriter text="Shopping lists" style={T.h1} />
          <Text style={T.small}>Lists your customers sent. Billing is up to you.</Text>
        </View>
        <Bell />
      </View>
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : lists.length === 0 ? (
        <Empty title="No new lists" text="When a customer sends a list, it will appear here." />
      ) : lists.map((l, i) => {
        const items = l.shopping_list_items ?? [];
        const shown = open === l.id ? items : items.slice(0, 3);
        return (
          <Petal key={l.id} color={pastelFor(l.shop_customer_id ?? l.id)} flip={i % 2 === 1} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.display, fontSize: 26, lineHeight: 34, color: C.ink }}>{l.customer_name ?? 'Customer'}</Text>
                <Text style={T.small}>{formatWhen(l.submitted_at ?? l.created_at)}</Text>
              </View>
              <Badge label={l.status === 'submitted' ? 'New' : 'Seen'} tone={l.status === 'submitted' ? 'gold' : 'plum'} />
            </View>
            <View style={{ marginTop: 10, gap: 3 }}>
              {shown.map((it) => (
                <Text key={it.id} style={T.body}>• {it.product_name_snapshot} × {formatQty(it.quantity)} {UNIT_LABEL[it.unit]}</Text>
              ))}
              {open !== l.id && items.length > 3 ? <Text style={T.small}>+ {items.length - 3} more</Text> : null}
            </View>
            {open === l.id && l.notes ? <Text style={[T.body, { marginTop: 8, fontStyle: 'italic' }]}>"{l.notes}"</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Btn small label={open === l.id ? 'Hide list' : 'View list'} variant="ghost" style={{ flex: 1 }} onPress={() => view(l.id, l.status)} />
              <Btn small label="Create bill" icon="file-plus" style={{ flex: 1 }}
                onPress={() => router.push(`/billing?listId=${l.id}${l.shop_customer_id ? `&customerId=${l.shop_customer_id}` : ''}`)} />
            </View>
          </Petal>
        );
      })}
    </Screen>
  );
}
