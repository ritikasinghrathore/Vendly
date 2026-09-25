import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Empty, ErrorBox, Loading, Petal, Screen } from '../../src/components/ui';
import { RupeeCount, Typewriter } from '../../src/components/motion';
import { C, F, T, pastelFor } from '../../src/theme';
import { useLoad } from '../../src/lib/hooks';
import { formatRupees } from '../../src/lib/money';
import * as api from '../../src/lib/api';

export default function CustomerKhata() {
  const router = useRouter();
  const { data, loading, error, reload, pull, refreshing } = useLoad(() => api.myKhata(), []);
  const rows = data ?? [];
  const owed = rows.reduce((s, r) => s + Math.max(0, r.balancePaise), 0);

  return (
    <Screen onRefresh={pull} refreshing={refreshing}>
      <View style={{ marginBottom: 14 }}>
        <Typewriter text="My khata" style={T.h1} />
        <Text style={T.small}>What you owe each shop, and every payment</Text>
      </View>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : rows.length === 0 ? (
        <Empty title="Nothing on khata" text="When a shop bills you and you don't pay in full, it shows up here." />
      ) : (
        <>
          <Petal color={owed > 0 ? C.gulabi : C.pista} style={{ padding: 22, marginBottom: 16 }}>
            <Text style={T.small}>{owed > 0 ? 'You owe in total' : 'You are all clear'}</Text>
            <RupeeCount paise={owed} style={{ fontFamily: F.bodyHeavy, fontSize: 40, lineHeight: 50, color: owed > 0 ? C.gulabiDeep : C.pistaDeep }} />
          </Petal>
          {rows.map((r, i) => (
            <Petal key={r.customerId} color={pastelFor(r.shop.id)} flip={i % 2 === 1} onPress={() => router.push(`/ledger/${r.customerId}`)}
              style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }} label={`Khata at ${r.shop.name}`}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.display, fontSize: 24, lineHeight: 32, color: C.ink }}>{r.shop.name}</Text>
                <Text style={T.small}>{r.shop.area ?? ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontFamily: F.bodyHeavy, fontSize: 18, color: C.ink }}>{formatRupees(Math.abs(r.balancePaise))}</Text>
                <Badge label={r.balancePaise > 0 ? 'Due' : r.balancePaise < 0 ? 'Advance' : 'All clear'} tone={r.balancePaise > 0 ? 'red' : 'green'} />
              </View>
            </Petal>
          ))}
        </>
      )}
    </Screen>
  );
}
