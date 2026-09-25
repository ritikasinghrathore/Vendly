import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Btn, Chip, ChipRow, Empty, ErrorBox, IconBtn, Loading, SearchBox, Stepper } from '../../src/components/ui';
import { Marquee } from '../../src/components/motion';
import { ShopAvatar } from '../../src/components/shop';
import { C, F, T, pastelFor } from '../../src/theme';
import { useLoad } from '../../src/lib/hooks';
import { UNIT_LABEL, UNIT_STEP, firstQty, formatQty, round3, shopTypeLabel } from '../../src/lib/format';
import { formatRupees, lineTotalPaise, rupees } from '../../src/lib/money';
import { callPhone, openWhatsApp } from '../../src/lib/share';
import * as api from '../../src/lib/api';
import type { Product } from '../../src/lib/types';

export default function Store() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const shopQ = useLoad(() => api.getShop(id), [id]);
  const prodQ = useLoad(() => api.listProducts(id), [id]);
  const catQ = useLoad(() => api.listCategories(), []);
  const draftQ = useLoad(() => api.getDraft(id), [id]);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [qty, setQty] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<Record<string, number>>({});

  // Put the saved draft list back on screen whenever it is (re)loaded.
  useEffect(() => {
    if (draftQ.loading) return;
    const m: Record<string, number> = {};
    (draftQ.data?.shopping_list_items ?? []).forEach((it) => { if (it.product_id) m[it.product_id] = Number(it.quantity); });
    setQty(m);
  }, [draftQ.loading, draftQ.data]);

  async function push(pid: string) {
    const t = timers.current[pid];
    if (t) { clearTimeout(t); delete timers.current[pid]; }
    const value = latest.current[pid];
    if (value === undefined) return;
    delete latest.current[pid];
    try {
      await api.setItemQty(id, pid, value);
    } catch (e: any) {
      Alert.alert('Could not update your list', e.message);
      draftQ.reload();
    }
  }
  const flush = () => Promise.all(Object.keys(timers.current).map(push));

  function change(p: Product, next: number) {
    const value = Math.max(0, round3(next));
    setQty((prev) => ({ ...prev, [p.id]: value }));
    latest.current[p.id] = value;
    clearTimeout(timers.current[p.id]);
    timers.current[p.id] = setTimeout(() => push(p.id), 450);
  }

  async function openList() {
    await flush();
    const draft = await api.getDraft(id);
    if (draft) router.push(`/list/${draft.id}`);
  }

  const shop = shopQ.data;
  const products = prodQ.data ?? [];
  const cats = catQ.data ?? [];
  const usedCats = useMemo(() => cats.filter((c) => products.some((p) => p.category_id === c.id)), [cats, products]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) =>
      p.is_active && (cat === 'all' || p.category_id === cat) &&
      (!needle || p.name.toLowerCase().includes(needle) || (p.name_hi ?? '').toLowerCase().includes(needle)));
  }, [products, q, cat]);

  const count = products.filter((p) => (qty[p.id] ?? 0) > 0).length;
  const estimate = products.reduce((s, p) => s + lineTotalPaise(qty[p.id] ?? 0, p.price), 0);

  if (shopQ.loading && !shop) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Loading /></SafeAreaView>;
  if (!shop) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><ErrorBox message={shopQ.error ?? 'We could not open this shop.'} onRetry={shopQ.reload} /></SafeAreaView>;

  const header = (
    <View>
      <View style={{ marginHorizontal: -20, marginTop: -20, backgroundColor: pastelFor(shop.id), paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, borderBottomRightRadius: 34, borderBottomLeftRadius: 10, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <IconBtn name="arrow-left" label="Go back" bg={C.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {shop.phone ? <IconBtn name="phone" label="Call the shop" bg={C.white} onPress={() => callPhone(shop.phone!)} /> : null}
            {shop.phone ? <IconBtn name="message-circle" label="Message on WhatsApp" bg={C.white} onPress={() => openWhatsApp(`Namaste, I found ${shop.name} on Vendly.`, shop.phone)} /> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ShopAvatar shop={shop} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.display, fontSize: 32, lineHeight: 42, color: C.ink }}>{shop.name}</Text>
            <Text style={T.small}>{[shop.address_line, shop.area, shop.city].filter(Boolean).join(', ')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Badge label={shop.is_open ? 'Open now' : 'Closed right now'} tone={shop.is_open ? 'green' : 'grey'} />
          <Badge label={shopTypeLabel(shop.shop_type)} tone="plum" />
          {shop.is_verified ? <Badge label="Verified" tone="gold" /> : null}
        </View>
      </View>
      {shop.tagline ? (
        <View style={{ marginHorizontal: -20, marginBottom: 12, paddingVertical: 8, backgroundColor: C.lavender }}>
          <Marquee items={[shop.tagline]} style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.plum }} />
        </View>
      ) : null}
      {!shop.is_open ? <Text style={[T.small, { marginBottom: 10 }]}>The shop is closed right now. You can still make a list and send it.</Text> : null}
      <SearchBox value={q} onChangeText={setQ} placeholder={`Search in ${shop.name}`} />
      {usedCats.length > 1 ? (
        <ChipRow>
          <Chip label="Everything" active={cat === 'all'} onPress={() => setCat('all')} />
          {usedCats.map((c) => <Chip key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} />)}
        </ChipRow>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 130 }}
        ListHeaderComponent={header}
        ListEmptyComponent={prodQ.loading ? <Loading /> : prodQ.error ? <ErrorBox message={prodQ.error} onRetry={prodQ.reload} /> : (
          <Empty title={products.length ? 'No match' : 'No items yet'} text={products.length ? 'Try another word.' : 'This shop has not listed its items yet.'} />
        )}
        renderItem={({ item: p }) => <ProductRow p={p} qty={qty[p.id] ?? 0} onChange={change} />}
      />
      {count > 0 ? (
        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 8 }} pointerEvents="box-none">
          <Pressable onPress={openList} accessibilityRole="button" accessibilityLabel="View my list"
            style={({ pressed }) => ({ backgroundColor: C.plum, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: pressed ? 0.9 : 1 })}>
            <View>
              <Text style={{ color: '#fff', fontFamily: F.bodyHeavy, fontSize: 16 }}>View my list</Text>
              <Text style={{ color: C.lavender, fontFamily: F.bodyMed, fontSize: 13 }}>{count} {count === 1 ? 'item' : 'items'} · about {formatRupees(estimate)}</Text>
            </View>
            <Feather name="arrow-right" size={22} color="#fff" />
          </Pressable>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

function ProductRow({ p, qty, onChange }: { p: Product; qty: number; onChange: (p: Product, n: number) => void }) {
  const out = !p.is_available || p.stock_quantity <= 0;
  const low = !out && p.stock_quantity <= p.low_stock_threshold;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: C.line, gap: 12 }}>
      {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: C.lavender, opacity: out ? 0.5 : 1 }} accessibilityLabel={p.name} /> : null}
      <View style={{ flex: 1, opacity: out ? 0.55 : 1 }}>
        <Text style={T.h3}>{p.name}</Text>
        {p.name_hi ? <Text style={T.small}>{p.name_hi}</Text> : null}
        <Text style={{ marginTop: 2 }}>
          <Text style={{ fontFamily: F.bodyHeavy, fontSize: 16, color: C.plum }}>{rupees(p.price)}</Text>
          <Text style={T.small}> / {UNIT_LABEL[p.unit]}</Text>
        </Text>
        {low ? <Text style={[T.small, { color: C.gulabiDeep }]}>Only {formatQty(p.stock_quantity)} {UNIT_LABEL[p.unit]} left</Text> : null}
      </View>
      {out ? <Badge label="Out of stock" tone="grey" /> : qty > 0 ? (
        <Stepper value={qty} step={UNIT_STEP[p.unit]} max={p.stock_quantity} unitLabel={UNIT_LABEL[p.unit]} onChange={(n) => onChange(p, n)} />
      ) : (
        <Btn small label="Add" icon="plus" onPress={() => onChange(p, firstQty(p.unit))} />
      )}
    </View>
  );
}
