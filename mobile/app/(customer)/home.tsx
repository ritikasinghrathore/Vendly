import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Chip, ChipRow, Empty, ErrorBox, Loading, Petal, Screen, SearchBox } from '../../src/components/ui';
import { Marquee, Typewriter } from '../../src/components/motion';
import { Bell, ShopAvatar } from '../../src/components/shop';
import { C, F, T, pastelFor } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { firstName, shopTypeLabel } from '../../src/lib/format';
import * as api from '../../src/lib/api';

export default function CustomerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, loading, error, reload, pull, refreshing } = useLoad(() => api.listShops(), []);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const shops = data ?? [];
  const types = useMemo(() => Array.from(new Set(shops.map((s) => s.shop_type))), [shops]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return shops.filter((s) =>
      (type === 'all' || s.shop_type === type) &&
      (!needle || `${s.name} ${s.area ?? ''} ${s.city} ${s.tagline ?? ''}`.toLowerCase().includes(needle)));
  }, [shops, q, type]);

  const open = shops.filter((s) => s.is_open).map((s) => `${s.name} is open`);
  const ribbon = open.length ? open : ['Make a list', 'Compare prices', 'Skip the queue', 'Keep your khata'];

  return (
    <Screen onRefresh={pull} refreshing={refreshing}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Typewriter text={`Namaste, ${firstName(user?.name)}`} style={T.h1} />
          <Text style={T.small}>Pick a shop and start your list</Text>
        </View>
        <Bell />
      </View>

      <View style={{ marginVertical: 14, marginHorizontal: -20, backgroundColor: C.lavender, paddingVertical: 9 }}>
        <Marquee items={ribbon} style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.plum }} />
      </View>

      <SearchBox value={q} onChangeText={setQ} placeholder="Search shops or localities" />
      {types.length > 1 ? (
        <ChipRow>
          <Chip label="All shops" active={type === 'all'} onPress={() => setType('all')} />
          {types.map((t) => <Chip key={t} label={shopTypeLabel(t)} active={type === t} onPress={() => setType(t)} />)}
        </ChipRow>
      ) : null}

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : filtered.length === 0 ? (
        <Empty title={shops.length ? 'No match' : 'No shops yet'}
          text={shops.length ? 'Try a different word or clear the filter.' : 'Ask your neighbourhood shopkeeper to join Vendly.'} />
      ) : filtered.map((s, i) => (
        <Petal key={s.id} color={pastelFor(s.id)} flip={i % 2 === 1} label={`Open ${s.name}`}
          onPress={() => router.push(`/store/${s.id}`)}
          style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ShopAvatar shop={s} size={66} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={{ fontFamily: F.display, fontSize: 27, lineHeight: 36, color: C.ink }}>{s.name}</Text>
            <Text style={T.small}>{[s.area, s.city].filter(Boolean).join(', ')}</Text>
            {s.tagline ? <Text numberOfLines={2} style={[T.body, { fontSize: 14 }]}>{s.tagline}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <Badge label={s.is_open ? 'Open now' : 'Closed'} tone={s.is_open ? 'green' : 'grey'} />
              <Badge label={shopTypeLabel(s.shop_type)} tone="plum" />
              {s.is_verified ? <Badge label="Verified" tone="gold" /> : null}
            </View>
          </View>
        </Petal>
      ))}
    </Screen>
  );
}
