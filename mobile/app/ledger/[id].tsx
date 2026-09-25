import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Btn, Card, Chip, ChipRow, ConfirmSheet, Divider, ErrorBox, Field, Header, Loading, Petal, Screen, Sheet } from '../../src/components/ui';
import { RupeeCount } from '../../src/components/motion';
import { Bell } from '../../src/components/shop';
import { C, F, T } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { formatWhen } from '../../src/lib/format';
import { formatRupees, parseAmount, toPaise } from '../../src/lib/money';
import { openWhatsApp } from '../../src/lib/share';
import * as api from '../../src/lib/api';
import type { PayMethod } from '../../src/lib/types';

const METHODS: PayMethod[] = ['cash', 'upi', 'card', 'other'];
const methodLabel = (m: PayMethod) => (m === 'upi' ? 'UPI' : m[0].toUpperCase() + m.slice(1));

export default function LedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const q = useLoad(() => api.getLedger(id), [id]);
  const led = q.data;

  // payment
  const [payOpen, setPayOpen] = useState(false);
  const [payConfirm, setPayConfirm] = useState(false);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [payNote, setPayNote] = useState('');
  const payReq = useRef(api.newRequestId());
  // adjustment
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjConfirm, setAdjConfirm] = useState(false);
  const [adjMore, setAdjMore] = useState(true);
  const [adjAmt, setAdjAmt] = useState('');
  const [adjWhy, setAdjWhy] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    let run = 0;
    const asc = (led?.txns ?? []).map((t) => { run += toPaise(t.amount); return { ...t, run }; });
    return asc.reverse();
  }, [led]);

  if (q.loading && !led) return <Screen edges={['top', 'bottom']}><Header title="Khata" back /><Loading /></Screen>;
  if (!led) return <Screen edges={['top', 'bottom']}><Header title="Khata" back /><ErrorBox message={q.error ?? 'We could not open this khata.'} onRetry={q.reload} /></Screen>;

  const shopInfo = led.customer.shops ?? { id: '', name: 'Shop', phone: null, owner_id: '' };
  const isOwner = shopInfo.owner_id === user?.id;
  const bal = led.balancePaise;
  const title = isOwner ? led.customer.name : shopInfo.name;
  const payPaise = toPaise(parseAmount(payAmt) ?? 0);
  const adjPaise = toPaise(parseAmount(adjAmt) ?? 0);

  function openPay() {
    payReq.current = api.newRequestId();
    setPayAmt(''); setPayNote(''); setPayMethod('cash'); setPayOpen(true);
  }
  function reviewPay() {
    if (parseAmount(payAmt) === null || payPaise <= 0) return Alert.alert('Payment', 'Enter the amount received.');
    if (payPaise > bal) return Alert.alert('Payment', `The customer owes ${formatRupees(bal)}. You cannot record more than that.`);
    setPayOpen(false); setPayConfirm(true);
  }
  async function submitPay() {
    setBusy(true);
    try {
      await api.recordPayment({ shopId: shopInfo.id, shopCustomerId: id, amount: payPaise / 100, method: payMethod, notes: payNote, requestId: payReq.current });
      setPayConfirm(false);
      await q.reload();
    } catch (e: any) { setPayConfirm(false); Alert.alert('Payment was not recorded', e.message); }
    finally { setBusy(false); }
  }

  function reviewAdj() {
    if (parseAmount(adjAmt) === null || adjPaise <= 0) return Alert.alert('Adjustment', 'Enter an amount above zero.');
    if (adjWhy.trim().length < 3) return Alert.alert('Adjustment', 'Write a short reason, for example "Old khata balance".');
    setAdjOpen(false); setAdjConfirm(true);
  }
  async function submitAdj() {
    setBusy(true);
    try {
      await api.recordAdjustment(shopInfo.id, id, adjPaise / 100, adjMore ? 'owes_more' : 'owes_less', adjWhy);
      setAdjConfirm(false); setAdjAmt(''); setAdjWhy('');
      await q.reload();
    } catch (e: any) { setAdjConfirm(false); Alert.alert('Adjustment was not saved', e.message); }
    finally { setBusy(false); }
  }

  function remind() {
    const shop = shopInfo;
    openWhatsApp(`Namaste ${led!.customer.name}, your balance at ${shop.name} is ${formatRupees(bal)}. Please clear it when you visit. Thank you!${shop.phone ? ` (${shop.phone})` : ''}`, led!.customer.phone);
  }

  return (
    <Screen edges={['top', 'bottom']} onRefresh={q.pull} refreshing={q.refreshing}>
      <Header title={title} subtitle={isOwner ? led.customer.phone ?? 'No phone saved' : 'Your khata at this shop'} back right={<Bell />} />

      <Petal color={bal > 0 ? C.gulabi : C.pista} style={{ padding: 22, marginBottom: 16 }}>
        <Text style={T.small}>{bal > 0 ? (isOwner ? 'Customer owes' : 'You owe') : bal < 0 ? 'Advance paid' : 'All clear'}</Text>
        <RupeeCount paise={Math.abs(bal)} style={{ fontFamily: F.bodyHeavy, fontSize: 42, lineHeight: 54, color: bal > 0 ? C.gulabiDeep : C.pistaDeep }} />
      </Petal>

      {isOwner ? (
        <View style={{ gap: 10, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label="Payment received" icon="arrow-down-left" style={{ flex: 1 }} onPress={openPay} disabled={bal <= 0} />
            <Btn label="New bill" icon="file-plus" variant="soft" style={{ flex: 1 }} onPress={() => router.push(`/billing?customerId=${id}`)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn small label="Add old balance / correction" variant="ghost" style={{ flex: 1 }} onPress={() => { setAdjMore(true); setAdjOpen(true); }} />
            {bal > 0 ? <Btn small label="Remind on WhatsApp" icon="message-circle" variant="ghost" style={{ flex: 1 }} onPress={remind} /> : null}
          </View>
        </View>
      ) : null}

      <Text style={[T.h3, { marginBottom: 8 }]}>Bills</Text>
      {led.bills.length === 0 ? <Text style={[T.small, { marginBottom: 14 }]}>No bills yet.</Text> : (
        <Card style={{ marginBottom: 18 }}>
          {led.bills.map((b, i) => (
            <View key={b.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable onPress={() => router.push(`/bill/${b.id}`)} accessibilityRole="button" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={T.h3}>Bill #{b.bill_number}</Text>
                  <Text style={T.small}>{formatWhen(b.created_at)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontFamily: F.bodyHeavy, fontSize: 16, color: C.ink }}>{formatRupees(toPaise(b.total_amount))}</Text>
                  <Badge label={b.payment_status === 'paid' ? 'Paid' : b.payment_status === 'partially_paid' ? `Due ${formatRupees(toPaise(b.amount_due))}` : 'Unpaid'} tone={b.payment_status === 'paid' ? 'green' : 'red'} />
                </View>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Text style={[T.h3, { marginBottom: 8 }]}>Every entry</Text>
      {rows.length === 0 ? <Text style={T.small}>Nothing recorded yet.</Text> : (
        <Card>
          {rows.map((t, i) => {
            const amt = toPaise(t.amount);
            const label = t.txn_type === 'bill' ? 'Bill' : t.txn_type === 'payment' ? 'Payment' : t.txn_type === 'refund' ? 'Refund' : 'Adjustment';
            return (
              <View key={t.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable disabled={!t.bill_id || t.txn_type === 'payment'} onPress={() => t.bill_id && router.push(`/bill/${t.bill_id}`)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={T.h3}>{label}</Text>
                    {t.notes ? <Text style={T.small}>{t.notes}</Text> : null}
                    <Text style={T.small}>{formatWhen(t.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: F.bodyHeavy, fontSize: 16, color: amt > 0 ? C.gulabiDeep : C.pistaDeep }}>{formatRupees(amt, { sign: true })}</Text>
                    <Text style={T.small}>Balance {formatRupees(t.run)}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
      <Text style={[T.small, { marginTop: 10 }]}>Entries are permanent. A mistake is fixed with a correction, never by erasing.</Text>

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} title="Payment received">
        <Text style={[T.small, { marginBottom: 10 }]}>{led.customer.name} owes {formatRupees(bal)}.</Text>
        <Field label="Amount received (₹)" value={payAmt} onChangeText={setPayAmt} keyboardType="decimal-pad" placeholder="0" autoFocus />
        <ChipRow>
          <Chip label={`All ${formatRupees(bal)}`} onPress={() => setPayAmt(String(bal / 100))} active={payPaise === bal} />
        </ChipRow>
        <ChipRow>{METHODS.map((m) => <Chip key={m} label={methodLabel(m)} active={payMethod === m} onPress={() => setPayMethod(m)} />)}</ChipRow>
        <Field label="Note (optional)" value={payNote} onChangeText={setPayNote} placeholder="e.g. Paid by his son" maxLength={120} />
        <Btn label="Review payment" onPress={reviewPay} />
      </Sheet>

      <ConfirmSheet visible={payConfirm} title="Confirm payment" confirmLabel="Confirm payment" busy={busy} onCancel={() => setPayConfirm(false)} onConfirm={submitPay}
        rows={[
          { left: 'Customer', right: led.customer.name, bold: true },
          { left: `Received (${methodLabel(payMethod)})`, right: formatRupees(payPaise), bold: true },
          { left: 'Owed before', right: formatRupees(bal) },
          { left: 'Owed after', right: formatRupees(bal - payPaise), bold: true },
        ]}>
        <Text style={[T.small, { marginBottom: 12 }]}>It is applied to the oldest unpaid bills first.</Text>
      </ConfirmSheet>

      <Sheet visible={adjOpen} onClose={() => setAdjOpen(false)} title="Correction / old balance">
        <ChipRow>
          <Chip label="Customer owes more" active={adjMore} onPress={() => setAdjMore(true)} />
          <Chip label="Customer owes less" active={!adjMore} onPress={() => setAdjMore(false)} />
        </ChipRow>
        <Field label="Amount (₹)" value={adjAmt} onChangeText={setAdjAmt} keyboardType="decimal-pad" placeholder="0" />
        <Field label="Reason" value={adjWhy} onChangeText={setAdjWhy} placeholder="e.g. Old balance from paper khata" maxLength={120} />
        <Btn label="Review" onPress={reviewAdj} />
      </Sheet>

      <ConfirmSheet visible={adjConfirm} title="Confirm correction" confirmLabel="Save correction" busy={busy} onCancel={() => setAdjConfirm(false)} onConfirm={submitAdj}
        rows={[
          { left: 'Customer', right: led.customer.name, bold: true },
          { left: adjMore ? 'Owes more by' : 'Owes less by', right: formatRupees(adjPaise), bold: true },
          { left: 'Reason', right: adjWhy.trim() },
          { left: 'Balance after', right: formatRupees(bal + (adjMore ? 1 : -1) * adjPaise), bold: true },
        ]} />
    </Screen>
  );
}
