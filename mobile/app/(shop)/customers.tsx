import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Btn, Chip, ChipRow, Empty, ErrorBox, Field, Loading, Petal, Screen, SearchBox, Sheet } from '../../src/components/ui';
import { RupeeCount, Typewriter } from '../../src/components/motion';
import { Bell } from '../../src/components/shop';
import { C, F, T, pastelFor } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { formatRupees, toPaise } from '../../src/lib/money';
import * as api from '../../src/lib/api';

export default function Customers() {
  const { activeShop } = useAuth();
  const shop = activeShop!;
  const router = useRouter();
  const params = useLocalSearchParams<{ owing?: string }>();
  const q = useLoad(() => api.listShopCustomers(shop.id), [shop.id]);
  const [search, setSearch] = useState('');
  const [owing, setOwing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (params.owing === '1') setOwing(true); }, [params.owing]);

  const all = q.data ?? [];
  const toCollect = all.reduce((s, c) => s + Math.max(0, toPaise(c.balance ?? 0)), 0);
  const shown = useMemo(() => {
    const n = search.trim().toLowerCase();
    return all
      .filter((c) => (!owing || toPaise(c.balance ?? 0) > 0) && (!n || `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(n)))
      .sort((a, b) => toPaise(b.balance ?? 0) - toPaise(a.balance ?? 0) || a.name.localeCompare(b.name));
  }, [all, search, owing]);

  async function add() {
    if (!name.trim()) return Alert.alert('Customer name', 'Please enter a name.');
    setBusy(true);
    try {
      const c = await api.addShopCustomer(shop.id, name, phone);
      setSheet(false); setName(''); setPhone('');
      await q.reload();
      router.push(`/ledger/${c.id}`);
    } catch (e: any) { Alert.alert('Could not add customer', e.message); }
    finally { setBusy(false); }
  }

  return (
    <Screen onRefresh={q.pull} refreshing={q.refreshing}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Typewriter text="Khata" style={T.h1} />
          <Text style={T.small}>Your customers and what they owe</Text>
        </View>
        <Bell />
      </View>

      <Petal color={toCollect > 0 ? C.gulabi : C.pista} style={{ padding: 20, marginBottom: 16 }}>
        <Text style={T.small}>{toCollect > 0 ? 'To collect in total' : 'Nothing pending'}</Text>
        <RupeeCount paise={toCollect} style={{ fontFamily: F.bodyHeavy, fontSize: 38, lineHeight: 48, color: toCollect > 0 ? C.gulabiDeep : C.pistaDeep }} />
      </Petal>

      <SearchBox value={search} onChangeText={setSearch} placeholder="Search customers" />
      <ChipRow>
        <Chip label="Everyone" active={!owing} onPress={() => setOwing(false)} />
        <Chip label="Owes money" active={owing} onPress={() => setOwing(true)} />
      </ChipRow>
      <Btn label="Add customer" icon="user-plus" variant="soft" onPress={() => setSheet(true)} style={{ marginBottom: 14 }} />

      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : shown.length === 0 ? (
        <Empty title={all.length === 0 ? 'No customers yet' : 'No one here'} text={all.length === 0 ? 'Customers who send you a list appear automatically. You can also add walk-in customers.' : 'Try another search.'} />
      ) : shown.map((c, i) => {
        const bal = toPaise(c.balance ?? 0);
        return (
          <Petal key={c.id} color={pastelFor(c.id)} flip={i % 2 === 1} onPress={() => router.push(`/ledger/${c.id}`)} label={`Open ${c.name}`}
            style={{ marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.display, fontSize: 24, lineHeight: 32, color: C.ink }}>{c.name}</Text>
              <Text style={T.small}>{c.phone ?? 'No phone saved'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontFamily: F.bodyHeavy, fontSize: 17, color: C.ink }}>{formatRupees(Math.abs(bal))}</Text>
              <Badge label={bal > 0 ? 'Due' : bal < 0 ? 'Advance' : 'Clear'} tone={bal > 0 ? 'red' : 'green'} />
            </View>
          </Petal>
        );
      })}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="New customer">
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" autoFocus />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit number" />
        <Btn label="Save customer" onPress={add} loading={busy} />
      </Sheet>
    </Screen>
  );
}
