import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Card, Empty, ErrorBox, Loading, Screen, SearchBox } from '../../src/components/ui';
import { Typewriter } from '../../src/components/motion';
import { C, F, T } from '../../src/theme';
import { rupees, toPaise } from '../../src/lib/money';
import { UNIT_LABEL } from '../../src/lib/format';
import * as api from '../../src/lib/api';

export default function Compare() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<api.ProductHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setErr(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try { const r = await api.searchProducts(q); if (!cancelled) { setHits(r); setErr(null); } }
      catch (e: any) { if (!cancelled) setErr(e.message); }
      finally { if (!cancelled) setBusy(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  // Same product + same unit in different shops is grouped, cheapest first.
  const groups = useMemo(() => {
    const m = new Map<string, api.ProductHit[]>();
    hits.forEach((h) => {
      const key = `${h.name.trim().toLowerCase()}|${h.unit}`;
      m.set(key, [...(m.get(key) ?? []), h]);
    });
    return Array.from(m.values()).map((g) => g.sort((a, b) => toPaise(a.price) - toPaise(b.price)));
  }, [hits]);

  return (
    <Screen>
      <View style={{ marginBottom: 14 }}>
        <Typewriter text="Compare prices" style={T.h1} />
        <Text style={T.small}>See who sells it, and for how much. English or हिन्दी.</Text>
      </View>
      <SearchBox value={q} onChangeText={setQ} placeholder="Try rice, chawal, agarbatti" />
      {busy ? <Loading /> : err ? <ErrorBox message={err} /> : q.trim().length < 2 ? (
        <Empty title="What do you need?" text="Type at least two letters." />
      ) : groups.length === 0 ? (
        <Empty title="Nothing found" text="No shop lists that yet. Try another spelling." />
      ) : groups.map((g) => (
        <Card key={`${g[0].name}|${g[0].unit}`} style={{ marginBottom: 14 }}>
          <Text style={{ fontFamily: F.display, fontSize: 26, lineHeight: 34, color: C.ink }}>{g[0].name}</Text>
          {g[0].name_hi ? <Text style={T.small}>{g[0].name_hi}</Text> : null}
          {g.map((h, i) => {
            const out = !h.is_available || h.stock_quantity <= 0;
            return (
              <Text key={h.id} onPress={() => router.push(`/store/${h.shop_id}`)} accessibilityRole="link"
                style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: C.line }}>
                <Text style={{ fontFamily: F.bodyHeavy, fontSize: 16, color: out ? C.inkSoft : C.plum }}>{rupees(h.price)}</Text>
                <Text style={T.small}> / {UNIT_LABEL[h.unit]}   </Text>
                <Text style={[T.body, { fontFamily: F.bodyBold }]}>{h.shop_name}</Text>
                <Text style={T.small}>  {[h.shop_area, h.shop_city].filter(Boolean).join(', ')}</Text>
                {i === 0 && g.length > 1 && !out ? <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.pistaDeep }}>   Lowest price</Text> : null}
                {out ? <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.gulabiDeep }}>   Out of stock</Text> : null}
              </Text>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}
