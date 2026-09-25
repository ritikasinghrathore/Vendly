import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Empty, ErrorBox, Loading, Petal, Screen } from '../../src/components/ui';
import { Typewriter } from '../../src/components/motion';
import { T, pastelFor } from '../../src/theme';
import { useLoad } from '../../src/lib/hooks';
import { STATUS_LABEL, formatWhen } from '../../src/lib/format';
import * as api from '../../src/lib/api';

export default function MyLists() {
  const router = useRouter();
  const { data, loading, error, reload, pull, refreshing } = useLoad(() => api.myLists(), []);
  const lists = data ?? [];
  return (
    <Screen onRefresh={pull} refreshing={refreshing}>
      <View style={{ marginBottom: 14 }}>
        <Typewriter text="My lists" style={T.h1} />
        <Text style={T.small}>Lists you are making, and lists you have sent</Text>
      </View>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : lists.length === 0 ? (
        <Empty title="No lists yet" text="Open a shop and tap Add on the things you need." />
      ) : lists.map((l, i) => {
        const n = l.item_count ?? 0;
        const st = STATUS_LABEL[l.status] ?? STATUS_LABEL.draft;
        return (
          <Petal key={l.id} color={pastelFor(l.shop_id)} flip={i % 2 === 1} onPress={() => router.push(`/list/${l.id}`)} style={{ marginBottom: 12 }} label={`Open list for ${l.shop_name}`}>
            <Text style={T.h3}>{l.shop_name ?? 'Shop'}</Text>
            <Text style={T.small}>{n} {n === 1 ? 'item' : 'items'} · {formatWhen(l.submitted_at ?? l.created_at)}</Text>
            <View style={{ marginTop: 8 }}><Badge label={st.text} tone={st.tone} /></View>
          </Petal>
        );
      })}
    </Screen>
  );
}
