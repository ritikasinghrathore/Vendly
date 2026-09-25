import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Btn, Card, Divider, Empty, ErrorBox, Field, Header, Loading, Petal, Row, Screen, Stepper } from '../../src/components/ui';
import { Typewriter } from '../../src/components/motion';
import { C, F, T } from '../../src/theme';
import { useLoad } from '../../src/lib/hooks';
import { STATUS_LABEL, UNIT_LABEL, UNIT_STEP, formatQty, formatWhen } from '../../src/lib/format';
import { formatRupees, lineTotalPaise, rupees } from '../../src/lib/money';
import { callPhone, openWhatsApp } from '../../src/lib/share';
import * as api from '../../src/lib/api';
import type { ListItem } from '../../src/lib/types';

const STEPS = [
  { key: 'submitted', label: 'Sent' },
  { key: 'viewed', label: 'Seen by shop' },
  { key: 'completed', label: 'Billed' },
];

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useLoad(() => api.getList(id), [id]);
  const list = q.data;
  const [items, setItems] = useState<ListItem[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (list) { setItems(list.shopping_list_items ?? []); setNotes(list.notes ?? ''); }
  }, [list]);

  if (q.loading && !list) return <Screen edges={['top', 'bottom']}><Header title="My list" back /><Loading /></Screen>;
  if (!list) return <Screen edges={['top', 'bottom']}><Header title="My list" back /><ErrorBox message={q.error ?? 'We could not open this list.'} onRetry={q.reload} /></Screen>;

  const shop = list.shops;
  const draft = list.status === 'draft';
  const st = STATUS_LABEL[list.status];
  const estimate = items.reduce((s, it) => s + (it.products ? lineTotalPaise(it.quantity, it.products.price) : 0), 0);
  const unavailable = items.filter((it) => it.products && (!it.products.is_available || it.products.stock_quantity <= 0));
  const stepIndex = STEPS.findIndex((s) => s.key === list.status);

  async function change(it: ListItem, next: number) {
    if (!it.product_id) return;
    const prev = items;
    setItems(items.map((x) => (x.id === it.id ? { ...x, quantity: next } : x)).filter((x) => x.quantity > 0));
    setBusy(true);
    try { await api.setItemQty(list!.id, it.product_id, next); }
    catch (e: any) { setItems(prev); Alert.alert('Could not update', e.message); }
    finally { setBusy(false); }
  }

  function send() {
    Alert.alert(`Send this list to ${shop?.name}?`, 'The shop will see it. Nothing is billed until you collect your items at the shop.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Send list', onPress: async () => {
        setSending(true);
        try {
          if (notes.trim() !== (list!.notes ?? '')) await api.setListNotes(list!.id, notes);
          await api.submitList(list!.id);
          await q.reload();
        } catch (e: any) { Alert.alert('List not sent', e.message); }
        finally { setSending(false); }
      } },
    ]);
  }

  function discard() {
    Alert.alert('Discard this list?', 'The items on it will be removed.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => {
        try { await api.discardDraft(list!.id); router.back(); } catch (e: any) { Alert.alert('Could not discard', e.message); }
      } },
    ]);
  }

  return (
    <Screen edges={['top', 'bottom']} onRefresh={q.pull} refreshing={q.refreshing}>
      <Header title={shop?.name ?? 'My list'} subtitle={draft ? 'Your list, not sent yet' : formatWhen(list.submitted_at ?? list.created_at)} back />

      {!draft && st ? (
        <Petal color={C.pista} style={{ marginBottom: 16 }}>
          <Typewriter text={list.status === 'completed' ? 'The shop billed this list.' : `Your list is with ${shop?.name}.`} style={T.h2} />
          <Text style={[T.body, { marginTop: 4 }]}>Nothing is billed until you collect your items at the shop.</Text>
          {list.status !== 'cancelled' ? (
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 6 }}>
              {STEPS.map((s, i) => (
                <View key={s.key} style={{ flex: 1 }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: i <= stepIndex ? C.pistaDeep : '#ffffff99' }} />
                  <Text style={[T.small, { marginTop: 4, color: i <= stepIndex ? C.pistaDeep : C.inkSoft }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Petal>
      ) : null}

      {items.length === 0 ? (
        <Empty title="This list is empty" text="Go back to the shop and tap Add on what you need." action={<Btn label="Back to the shop" onPress={() => router.back()} />} />
      ) : (
        <Card style={{ marginBottom: 14 }}>
          {items.map((it, i) => (
            <View key={it.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={T.h3}>{it.product_name_snapshot}</Text>
                  {it.products ? <Text style={T.small}>{rupees(it.products.price)} / {UNIT_LABEL[it.unit]}</Text> : null}
                  {it.products && (!it.products.is_available || it.products.stock_quantity <= 0) ? <Badge label="Not available right now" tone="red" /> : null}
                </View>
                {draft ? (
                  <Stepper value={Number(it.quantity)} step={UNIT_STEP[it.unit]} unitLabel={UNIT_LABEL[it.unit]} busy={busy} onChange={(n) => change(it, n)} />
                ) : (
                  <Text style={{ fontFamily: F.bodyHeavy, fontSize: 15, color: C.ink }}>{formatQty(it.quantity)} {UNIT_LABEL[it.unit]}</Text>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}

      {items.length > 0 ? (
        <Row left="About (at today's prices)" right={formatRupees(estimate)} bold style={{ marginBottom: 12 }} />
      ) : null}
      {unavailable.length > 0 && draft ? <Text style={[T.small, { color: C.gulabiDeep, marginBottom: 10 }]}>{unavailable.length} item(s) are not available right now. You can still send the list.</Text> : null}

      {draft ? (
        <>
          <Field label="A note for the shop (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. I will come at 6 pm" multiline maxLength={500} inputStyle={{ minHeight: 70 }} />
          <Btn label={`Send list to ${shop?.name ?? 'shop'}`} onPress={send} loading={sending} disabled={items.length === 0} icon="send" />
          <View style={{ height: 10 }} />
          <Btn label="Discard list" variant="ghost" onPress={discard} />
        </>
      ) : (
        <>
          {list.notes ? <Card style={{ marginBottom: 14 }}><Text style={T.small}>Your note</Text><Text style={T.body}>{list.notes}</Text></Card> : null}
          {shop?.phone ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label="Call shop" icon="phone" variant="soft" style={{ flex: 1 }} onPress={() => callPhone(shop.phone!)} />
              <Btn label="WhatsApp" icon="message-circle" variant="soft" style={{ flex: 1 }}
                onPress={() => openWhatsApp(`Namaste, I sent you a shopping list on Vendly.`, shop.phone)} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
