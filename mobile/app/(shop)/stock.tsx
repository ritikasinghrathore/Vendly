import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Chip, ChipRow, Empty, ErrorBox, IconBtn, Loading, SearchBox } from '../../src/components/ui';
import { Typewriter } from '../../src/components/motion';
import { C, F, T } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { UNIT_LABEL, formatQty } from '../../src/lib/format';
import { rupees } from '../../src/lib/money';
import * as api from '../../src/lib/api';
import type { Product } from '../../src/lib/types';

type Filter = 'all' | 'low' | 'out' | 'hidden';

export default function Stock() {
  const { activeShop } = useAuth();
  const shop = activeShop!;
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const q = useLoad(() => api.listProducts(shop.id), [shop.id]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => { if (params.filter === 'low') setFilter('low'); }, [params.filter]);

  const all = q.data ?? [];
  const isOut = (p: Product) => p.stock_quantity <= 0 || !p.is_available;
  const isLow = (p: Product) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold;
  const counts = useMemo(() => ({
    low: all.filter((p) => p.is_active && isLow(p)).length,
    out: all.filter((p) => p.is_active && isOut(p)).length,
    hidden: all.filter((p) => !p.is_active).length,
  }), [all]);

  const shown = useMemo(() => {
    const n = search.trim().toLowerCase();
    return all.filter((p) => {
      if (filter === 'hidden' ? p.is_active : !p.is_active) return false;
      if (filter === 'low' && !isLow(p)) return false;
      if (filter === 'out' && !isOut(p)) return false;
      return !n || p.name.toLowerCase().includes(n) || (p.name_hi ?? '').toLowerCase().includes(n);
    });
  }, [all, search, filter]);

  async function toggle(p: Product, value: boolean) {
    const prev = all;
    q.setData(all.map((x) => (x.id === p.id ? { ...x, is_available: value } : x)));
    try { await api.updateProduct(shop.id, p.id, { is_available: value }); }
    catch (e: any) { q.setData(prev); Alert.alert('Could not change', e.message); }
  }

  const header = (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Typewriter text="Your stock" style={T.h1} />
          <Text style={T.small}>{all.filter((p) => p.is_active).length} items · {counts.low} low · {counts.out} out</Text>
        </View>
        <IconBtn name="plus" label="Add a product" bg={C.plum} color="#fff" onPress={() => router.push('/product/edit')} />
      </View>
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search your products" />
      <ChipRow>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Low stock (${counts.low})`} active={filter === 'low'} onPress={() => setFilter('low')} />
        <Chip label={`Out (${counts.out})`} active={filter === 'out'} onPress={() => setFilter('out')} />
        <Chip label={`Hidden (${counts.hidden})`} active={filter === 'hidden'} onPress={() => setFilter('hidden')} />
      </ChipRow>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        refreshing={q.refreshing}
        onRefresh={q.pull}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        ListHeaderComponent={header}
        ListEmptyComponent={q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
          <Empty title={all.length === 0 ? 'Add your first item' : 'Nothing here'}
            text={all.length === 0 ? 'Tap the + button. Customers see the items and prices you list.' : 'No products match this filter.'} />
        )}
        renderItem={({ item: p }) => (
          <Pressable onPress={() => router.push(`/product/edit?id=${p.id}`)} accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`}
            style={{ paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{p.name}</Text>
              {p.name_hi ? <Text style={T.small}>{p.name_hi}</Text> : null}
              <Text style={{ marginTop: 2 }}>
                <Text style={{ fontFamily: F.bodyHeavy, color: C.plum }}>{rupees(p.price)}</Text>
                <Text style={T.small}> / {UNIT_LABEL[p.unit]}   Stock: </Text>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>{formatQty(p.stock_quantity)} {UNIT_LABEL[p.unit]}</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {!p.is_active ? <Badge label="Hidden" tone="grey" /> : p.stock_quantity <= 0 ? <Badge label="Out of stock" tone="red" /> : isLow(p) ? <Badge label="Low stock" tone="gold" /> : null}
                {p.is_active && !p.is_available && p.stock_quantity > 0 ? <Badge label="Marked unavailable" tone="grey" /> : null}
              </View>
            </View>
            {p.is_active ? (
              <View style={{ alignItems: 'center' }}>
                <Switch value={p.is_available} onValueChange={(v) => toggle(p, v)} trackColor={{ true: C.pista, false: C.line }} thumbColor={p.is_available ? C.pistaDeep : '#fff'} accessibilityLabel={`${p.name} available`} />
                <Text style={[T.small, { fontSize: 11 }]}>{p.is_available ? 'In stock' : 'Off'}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
