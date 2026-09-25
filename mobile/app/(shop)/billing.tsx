import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Btn, Card, Chip, ChipRow, ConfirmSheet, Divider, Field, Loading, Petal, Row, Screen, SearchBox, Sheet } from '../../src/components/ui';
import { Typewriter } from '../../src/components/motion';
import { C, F, T } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { UNIT_LABEL, firstQty, formatQty, qtyLabel, round3 } from '../../src/lib/format';
import { computeBill, formatRupees, lineTotalPaise, parseAmount, parseQty, rupees, toPaise } from '../../src/lib/money';
import * as api from '../../src/lib/api';
import type { PayMethod, Product, ShopCustomer } from '../../src/lib/types';

type Line = { product: Product; qty: string };
const METHODS: PayMethod[] = ['cash', 'upi', 'card', 'other'];

export default function Billing() {
  const { activeShop } = useAuth();
  const shop = activeShop!;
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string; listId?: string }>();
  const productsQ = useLoad(() => api.listProducts(shop.id), [shop.id]);
  const customersQ = useLoad(() => api.listShopCustomers(shop.id), [shop.id]);

  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [method, setMethod] = useState<PayMethod>('cash');
  const [notes, setNotes] = useState('');
  const [listId, setListId] = useState<string | null>(null);
  const [cq, setCq] = useState('');
  const [pq, setPq] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCust, setNewCust] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [ncBusy, setNcBusy] = useState(false);
  const requestId = useRef(api.newRequestId());
  const prefilled = useRef<string | null>(null);

  const products = useMemo(() => (productsQ.data ?? []).filter((p) => p.is_active), [productsQ.data]);
  const customers = customersQ.data ?? [];

  // Opened from a customer's khata or from a shopping list: fill in the customer.
  useEffect(() => {
    const cid = params.customerId;
    if (cid && customers.length && customer?.id !== cid) {
      const c = customers.find((x) => x.id === cid);
      if (c) setCustomer(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.customerId, customersQ.data]);

  // Opened from a shopping list: fill in the items (the owner can still change every quantity).
  useEffect(() => {
    const lid = params.listId;
    if (!lid || prefilled.current === lid || !productsQ.data) return;
    prefilled.current = lid;
    api.getList(lid).then((list) => {
      const next: Line[] = [];
      const missing: string[] = [];
      (list.shopping_list_items ?? []).forEach((it) => {
        const p = products.find((x) => x.id === it.product_id);
        if (p) next.push({ product: p, qty: String(it.quantity) }); else missing.push(it.product_name_snapshot);
      });
      setLines(next);
      setListId(lid);
      if (missing.length) Alert.alert('Some items are not on your product list', missing.join(', '));
    }).catch((e) => Alert.alert('Could not open the list', e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.listId, productsQ.data]);

  // ---------------------------------------------------------------- maths (instant feedback; the database re-checks everything)
  const disc = parseAmount(discount);
  const paidAmt = parseAmount(paid);
  const calc = useMemo(
    () => computeBill(lines.map((l) => ({ qty: parseQty(l.qty) ?? 0, price: l.product.price })), disc ?? 0, paidAmt ?? 0),
    [lines, disc, paidAmt],
  );
  const problems = useMemo(() => {
    const e: string[] = [];
    if (!customer) e.push('Choose a customer.');
    if (lines.length === 0) e.push('Add at least one item.');
    if (disc === null) e.push('The discount is not a valid amount.');
    if (paidAmt === null) e.push('The amount paid is not a valid amount.');
    lines.forEach((l) => {
      const q = parseQty(l.qty);
      if (q !== null && q > l.product.stock_quantity) e.push(`${l.product.name}: only ${formatQty(l.product.stock_quantity)} ${UNIT_LABEL[l.product.unit]} in stock.`);
    });
    return Array.from(new Set([...e, ...calc.errors]));
  }, [customer, lines, disc, paidAmt, calc.errors]);

  // ---------------------------------------------------------------- actions
  function addProduct(p: Product) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i < 0) return [...prev, { product: p, qty: String(firstQty(p.unit)) }];
      const copy = [...prev];
      copy[i] = { ...copy[i], qty: String(round3((parseQty(copy[i].qty) ?? 0) + firstQty(p.unit))) };
      return copy;
    });
    setPq('');
  }
  function setQty(i: number, text: string) {
    const t = text.replace(',', '.');
    if (t === '' || /^\d*\.?\d{0,3}$/.test(t)) setLines((prev) => prev.map((l, j) => (j === i ? { ...l, qty: t } : l)));
  }
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, j) => j !== i));

  function reset() {
    setLines([]); setDiscount(''); setPaid(''); setNotes(''); setMethod('cash'); setCustomer(null); setListId(null);
    setCq(''); setPq('');
    prefilled.current = null;
    requestId.current = api.newRequestId();
    router.setParams({ listId: undefined, customerId: undefined });
  }

  async function addCustomer() {
    if (ncName.trim().length < 1) return Alert.alert('Customer name', 'Please enter a name.');
    setNcBusy(true);
    try {
      const c = await api.addShopCustomer(shop.id, ncName, ncPhone);
      await customersQ.reload();
      setCustomer({ ...c, balance: 0 });
      setNewCust(false); setNcName(''); setNcPhone('');
    } catch (e: any) { Alert.alert('Could not add customer', e.message); }
    finally { setNcBusy(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      const bill = await api.createBill({
        shopId: shop.id, shopCustomerId: customer!.id,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: parseQty(l.qty)! })),
        discount: disc ?? 0, paid: paidAmt ?? 0, method, notes, listId, requestId: requestId.current,
      });
      setConfirm(false);
      reset();
      router.push(`/bill/${bill.id}?fresh=1`);
    } catch (e: any) {
      setConfirm(false);
      const msg: string = e.message ?? '';
      Alert.alert('Bill could not be saved', /No payment|could not confirm|safe to retry/.test(msg) ? msg : `${msg}\n\nNo payment or stock was changed.`);
    } finally { setBusy(false); }
  }

  // ---------------------------------------------------------------- view
  const custMatches = useMemo(() => {
    const n = cq.trim().toLowerCase();
    const list = n ? customers.filter((c) => `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(n)) : customers;
    return list.slice(0, 6);
  }, [customers, cq]);
  const prodMatches = useMemo(() => {
    const n = pq.trim().toLowerCase();
    if (!n) return [];
    return products.filter((p) => p.name.toLowerCase().includes(n) || (p.name_hi ?? '').toLowerCase().includes(n)).slice(0, 8);
  }, [products, pq]);

  const section = (t: string) => <Text style={[T.h3, { marginTop: 22, marginBottom: 8 }]}>{t}</Text>;

  return (
    <Screen>
      <Typewriter text="Make a bill" style={T.h1} />
      <Text style={[T.small, { marginBottom: 6 }]}>Prices come from your product list. The total is calculated for you.</Text>

      {section('1 · Customer')}
      {customer ? (
        <Petal color={C.pista} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.display, fontSize: 26, lineHeight: 34, color: C.ink }}>{customer.name}</Text>
            <Text style={T.small}>{customer.phone ?? 'No phone saved'}{customer.balance ? ` · owes ${formatRupees(toPaise(customer.balance))}` : ''}</Text>
          </View>
          <Btn small variant="ghost" label="Change" onPress={() => { setCustomer(null); router.setParams({ customerId: undefined }); }} />
        </Petal>
      ) : (
        <View>
          <SearchBox value={cq} onChangeText={setCq} placeholder="Search customer by name or phone" />
          {customersQ.loading ? <Loading /> : custMatches.map((c) => (
            <Pressable key={c.id} onPress={() => setCustomer(c)} accessibilityRole="button"
              style={{ paddingVertical: 11, borderBottomWidth: 1.5, borderBottomColor: C.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View><Text style={T.h3}>{c.name}</Text><Text style={T.small}>{c.phone ?? 'No phone'}</Text></View>
              {c.balance ? <Badge label={`Owes ${formatRupees(toPaise(c.balance))}`} tone="red" /> : null}
            </Pressable>
          ))}
          <View style={{ marginTop: 10 }}><Btn label="New customer" icon="user-plus" variant="soft" onPress={() => setNewCust(true)} /></View>
        </View>
      )}

      {section('2 · Items')}
      <SearchBox value={pq} onChangeText={setPq} placeholder="Search your products, English or हिन्दी" />
      {productsQ.loading ? <Loading /> : null}
      {prodMatches.map((p) => {
        const out = p.stock_quantity <= 0;
        return (
          <Pressable key={p.id} onPress={() => addProduct(p)} accessibilityRole="button" accessibilityLabel={`Add ${p.name}`}
            style={{ paddingVertical: 11, borderBottomWidth: 1.5, borderBottomColor: C.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: out ? 0.5 : 1 }}>
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{p.name}{p.name_hi ? `  ·  ${p.name_hi}` : ''}</Text>
              <Text style={T.small}>{rupees(p.price)} / {UNIT_LABEL[p.unit]} · stock {formatQty(p.stock_quantity)}</Text>
            </View>
            <Feather name="plus-circle" size={24} color={C.plum} />
          </Pressable>
        );
      })}
      {pq.trim() && prodMatches.length === 0 && !productsQ.loading ? (
        <Text style={[T.small, { marginVertical: 8 }]}>No product matches. Add it from the Stock tab first.</Text>
      ) : null}

      {lines.map((l, i) => {
        const q = parseQty(l.qty);
        const lt = q ? lineTotalPaise(q, l.product.price) : 0;
        const over = q !== null && q > l.product.stock_quantity;
        return (
          <Card key={l.product.id} style={{ marginTop: 10, borderColor: over ? C.gulabiDeep : C.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={T.h3}>{l.product.name}</Text>
                <Text style={T.small}>{rupees(l.product.price)} / {UNIT_LABEL[l.product.unit]}</Text>
              </View>
              <Pressable onPress={() => removeLine(i)} hitSlop={10} accessibilityLabel={`Remove ${l.product.name}`}><Feather name="trash-2" size={20} color={C.gulabiDeep} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput value={l.qty} onChangeText={(t) => setQty(i, t)} keyboardType="decimal-pad" selectTextOnFocus accessibilityLabel={`Quantity of ${l.product.name}`}
                  style={{ width: 84, minHeight: 44, borderRadius: 12, borderWidth: 1.5, borderColor: over ? C.gulabiDeep : C.line, backgroundColor: C.white, textAlign: 'center', fontFamily: F.bodyHeavy, fontSize: 17, color: C.ink }} />
                <Text style={T.small}>{UNIT_LABEL[l.product.unit]}</Text>
              </View>
              <Text style={{ fontFamily: F.bodyHeavy, fontSize: 18, color: C.ink }}>{formatRupees(lt)}</Text>
            </View>
            {over ? <Text style={[T.small, { color: C.gulabiDeep, marginTop: 6 }]}>Only {qtyLabel(l.product.stock_quantity, l.product.unit)} in stock.</Text> : null}
          </Card>
        );
      })}

      {section('3 · Payment')}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Field style={{ flex: 1 }} label="Discount (₹)" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0" />
        <Field style={{ flex: 1 }} label="Paid now (₹)" value={paid} onChangeText={setPaid} keyboardType="decimal-pad" placeholder="0" />
      </View>
      <ChipRow>
        <Chip label="Nothing now (khata)" active={paid === '' || paidAmt === 0} onPress={() => setPaid('')} />
        <Chip label="Paid in full" active={calc.total > 0 && calc.paid === calc.total} onPress={() => setPaid(String(calc.total / 100))} />
      </ChipRow>
      {calc.paid > 0 ? (
        <ChipRow>{METHODS.map((m) => <Chip key={m} label={m === 'upi' ? 'UPI' : m[0].toUpperCase() + m.slice(1)} active={method === m} onPress={() => setMethod(m)} />)}</ChipRow>
      ) : null}
      <Field label="Note (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. Deliver to the house" maxLength={200} />

      <Card style={{ marginTop: 6 }}>
        <Row left="Subtotal" right={formatRupees(calc.subtotal)} />
        {calc.discount > 0 ? <Row left="Discount" right={`- ${formatRupees(calc.discount)}`} /> : null}
        <Divider />
        <Row left="Total" right={formatRupees(calc.total)} bold />
        <Row left="Paid now" right={formatRupees(calc.paid)} />
        <Row left="Goes on khata" right={formatRupees(calc.due)} bold />
      </Card>

      <View style={{ marginTop: 16 }}>
        <Btn label="Review bill" icon="check-circle" onPress={() => setConfirm(true)} disabled={problems.length > 0} />
        {problems.length > 0 ? <Text style={[T.small, { marginTop: 8, textAlign: 'center' }]}>To continue: {problems[0]}</Text> : null}
        {(lines.length > 0 || customer) ? <View style={{ marginTop: 10 }}><Btn small variant="ghost" label="Clear this bill" onPress={() => Alert.alert('Clear this bill?', 'Everything you entered will be removed.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: reset }])} /></View> : null}
      </View>

      <ConfirmSheet visible={confirm} title="Check the bill" confirmLabel="Confirm bill" busy={busy} onCancel={() => setConfirm(false)} onConfirm={submit}
        rows={[
          { left: 'Customer', right: customer?.name ?? '', bold: true },
          ...lines.map((l) => ({ left: `${l.product.name}  ${qtyLabel(parseQty(l.qty) ?? 0, l.product.unit)} × ${rupees(l.product.price)}`, right: formatRupees(lineTotalPaise(parseQty(l.qty) ?? 0, l.product.price)) })),
          ...(calc.discount > 0 ? [{ left: 'Discount', right: `- ${formatRupees(calc.discount)}` }] : []),
          { left: 'Total', right: formatRupees(calc.total), bold: true },
          { left: `Paid now${calc.paid > 0 ? ` (${method})` : ''}`, right: formatRupees(calc.paid) },
          { left: 'Due (goes on khata)', right: formatRupees(calc.due), bold: true },
        ]}>
        <Text style={[T.small, { marginBottom: 12 }]}>Stock is reduced and the khata is updated together. If anything fails, nothing is changed.</Text>
      </ConfirmSheet>

      <Sheet visible={newCust} onClose={() => setNewCust(false)} title="New customer">
        <Field label="Name" value={ncName} onChangeText={setNcName} placeholder="e.g. Ramesh Kumar" autoFocus />
        <Field label="Phone (optional)" value={ncPhone} onChangeText={setNcPhone} keyboardType="phone-pad" placeholder="10-digit number" />
        <Btn label="Save customer" onPress={addCustomer} loading={ncBusy} />
      </Sheet>
    </Screen>
  );
}
