import React, { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, Card, ErrorBox, IconBtn, Petal, Screen } from '../../src/components/ui';
import { CountUp, Marquee, RupeeCount, Typewriter } from '../../src/components/motion';
import { Bell, ShopAvatar } from '../../src/components/shop';
import { C, F, T } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { formatRupees, toPaise } from '../../src/lib/money';
import * as api from '../../src/lib/api';

const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function Bars({ days }: { days: api.SalesDay[] }) {
  const max = Math.max(1, ...days.map((d) => Number(d.sales)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8, marginTop: 8 }}>
      {days.map((d) => {
        const h = Math.max(4, (Number(d.sales) / max) * 84);
        const label = DAY[new Date(`${d.sale_day}T00:00:00`).getDay()];
        return (
          <View key={d.sale_day} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${d.sale_day}: sales ${formatRupees(toPaise(d.sales))}`}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 10, color: C.inkSoft, marginBottom: 3 }}>{Number(d.sales) > 0 ? formatRupees(toPaise(d.sales)).replace('₹', '') : ''}</Text>
            <View style={{ width: '100%', height: h, backgroundColor: Number(d.sales) > 0 ? C.plum : C.lavender, borderTopLeftRadius: 10, borderTopRightRadius: 4 }} />
            <Text style={[T.small, { marginTop: 4 }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function Dashboard() {
  const { activeShop, refresh } = useAuth();
  const shop = activeShop!;
  const router = useRouter();
  const dq = useLoad(() => api.dashboard(shop.id), [shop.id]);
  const sq = useLoad(() => api.salesSummary(shop.id, 7), [shop.id]);
  const [toggling, setToggling] = useState(false);
  const d = dq.data;

  async function toggleOpen() {
    setToggling(true);
    try { await api.updateShop(shop.id, { isOpen: !shop.is_open }); await refresh(); }
    catch (e: any) { Alert.alert('Could not change', e.message); }
    finally { setToggling(false); }
  }

  const ribbon = d
    ? [`Today's sales ${formatRupees(toPaise(d.todaySales))}`, `${d.todayBills} ${d.todayBills === 1 ? 'bill' : 'bills'} today`,
       `${formatRupees(toPaise(d.outstanding))} to collect`, `${d.newLists} new ${d.newLists === 1 ? 'list' : 'lists'}`, `${d.lowStock} low on stock`]
    : [shop.name];

  const tile = (color: string, label: string, body: React.ReactNode, onPress: () => void, flip?: boolean) => (
    <Petal color={color} flip={flip} onPress={onPress} label={label} style={{ flex: 1, minHeight: 112, justifyContent: 'space-between' }}>
      <Text style={T.small}>{label}</Text>
      {body}
    </Petal>
  );
  const big = { fontFamily: F.bodyHeavy, fontSize: 26, lineHeight: 34, color: C.ink } as const;

  return (
    <Screen onRefresh={() => { dq.pull(); sq.pull(); }} refreshing={dq.refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <ShopAvatar shop={shop} size={52} />
        <View style={{ flex: 1 }}>
          <Typewriter text={shop.name} style={{ fontFamily: F.display, fontSize: 30, lineHeight: 40, color: C.ink }} speed={45} />
        </View>
        <Bell />
        <IconBtn name="settings" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={T.small}>{shop.is_open ? 'Your shop shows as open' : 'Your shop shows as closed'}</Text>
        <Switch value={shop.is_open} onValueChange={toggleOpen} disabled={toggling} trackColor={{ true: C.pista, false: C.line }} thumbColor={shop.is_open ? C.pistaDeep : '#fff'} accessibilityLabel="Shop open or closed" />
      </View>

      <View style={{ marginHorizontal: -20, backgroundColor: C.lavender, paddingVertical: 9, marginBottom: 16 }}>
        <Marquee items={ribbon} style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.plum }} />
      </View>

      {dq.error ? <ErrorBox message={dq.error} onRetry={dq.reload} /> : (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {tile(C.pista, "Today's sales", <RupeeCount paise={toPaise(d?.todaySales ?? 0)} style={big} />, () => router.push('/customers'))}
            {tile(C.gulabi, 'To collect', <RupeeCount paise={toPaise(d?.outstanding ?? 0)} style={big} />, () => router.push('/customers?owing=1'), true)}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {tile(C.butter, 'Pending bills', <CountUp value={d?.pendingBills ?? 0} format={(n) => String(Math.round(n))} style={big} />, () => router.push('/customers?owing=1'), true)}
            {tile(C.peach, 'Low stock', <CountUp value={d?.lowStock ?? 0} format={(n) => String(Math.round(n))} style={big} />, () => router.push('/stock?filter=low'))}
          </View>
          {tile(C.lavender, 'New shopping lists', <CountUp value={d?.newLists ?? 0} format={(n) => String(Math.round(n))} style={big} />, () => router.push('/incoming'), true)}
        </View>
      )}

      <View style={{ marginTop: 20, gap: 10 }}>
        <Btn label="Make a bill" icon="file-plus" onPress={() => router.push('/billing')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label="Add product" icon="plus" variant="soft" style={{ flex: 1 }} onPress={() => router.push('/product/edit')} />
          <Btn label="Customers" icon="users" variant="soft" style={{ flex: 1 }} onPress={() => router.push('/customers')} />
        </View>
      </View>

      <Card style={{ marginTop: 22 }}>
        <Text style={T.h3}>Last 7 days</Text>
        {sq.error ? <Text style={[T.small, { color: C.gulabiDeep }]}>{sq.error}</Text> : <Bars days={sq.data ?? []} />}
      </Card>
    </Screen>
  );
}
