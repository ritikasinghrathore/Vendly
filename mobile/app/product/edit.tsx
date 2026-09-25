import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Btn, Card, Chip, ChipRow, ErrorBox, Field, Header, Loading, Screen } from '../../src/components/ui';
import { C, F, T } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { UNITS, UNIT_LABEL, formatQty } from '../../src/lib/format';
import { parseAmount, parseQty, rupees } from '../../src/lib/money';
import { pickImage } from '../../src/lib/pick';
import * as api from '../../src/lib/api';
import type { UnitType } from '../../src/lib/types';

export default function ProductEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeShop } = useAuth();
  const shop = activeShop!;
  const router = useRouter();
  const editing = !!id;

  const catQ = useLoad(() => api.listCategories(), []);
  const prodQ = useLoad(() => (id ? api.getProduct(shop.id, id) : Promise.resolve(null)), [id]);
  const p = prodQ.data;

  const [name, setName] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [unit, setUnit] = useState<UnitType>('piece');
  const [price, setPrice] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [low, setLow] = useState('5');
  const [stock, setStock] = useState('');
  const [image, setImage] = useState<{ base64: string; mime: string; uri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [mode, setMode] = useState<'add' | 'reduce' | 'set'>('add');
  const [qty, setQty] = useState('');
  const [stockBusy, setStockBusy] = useState(false);

  useEffect(() => {
    if (!p) return;
    setName(p.name); setNameHi(p.name_hi ?? ''); setUnit(p.unit); setPrice(String(p.price));
    setCatId(p.category_id); setLow(String(p.low_stock_threshold));
  }, [p]);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter the product name.';
    const pr = parseAmount(price);
    if (pr === null || price.trim() === '') e.price = 'Enter a price, for example 60 or 12.50.';
    if (!editing && stock.trim() !== '' && parseQty(stock) === null) e.stock = 'Enter a valid quantity.';
    if (parseQty(low || '0') === null) e.low = 'Enter a valid number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      let imageId = p?.image_id ?? null;
      if (image) imageId = await api.uploadImage(image.mime, image.base64);
      if (editing) {
        await api.updateProduct(shop.id, id!, {
          name: name.trim(), name_hi: nameHi.trim() || null, price: parseAmount(price)!, category_id: catId,
          low_stock_threshold: parseQty(low || '0') ?? 5, image_id: imageId,
        });
      } else {
        await api.createProduct({
          shopId: shop.id, name: name.trim(), nameHi: nameHi.trim(), unit, price: parseAmount(price)!, categoryId: catId,
          openingStock: parseQty(stock || '0') ?? 0, lowStockThreshold: parseQty(low || '0') ?? 5, imageId,
        });
      }
      router.back();
    } catch (e: any) { Alert.alert('Could not save', e.message); }
    finally { setBusy(false); }
  }

  function applyStock() {
    const n = parseQty(qty);
    if (n === null || (mode !== 'set' && n <= 0)) return Alert.alert('Quantity', 'Enter a quantity above zero.');
    const text = mode === 'add' ? `Add ${formatQty(n)} ${UNIT_LABEL[p!.unit]} to ${p!.name}?`
      : mode === 'reduce' ? `Remove ${formatQty(n)} ${UNIT_LABEL[p!.unit]} from ${p!.name}?` : `Set the stock of ${p!.name} to exactly ${formatQty(n)} ${UNIT_LABEL[p!.unit]}?`;
    Alert.alert('Change stock', text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, change', onPress: async () => {
        setStockBusy(true);
        try { await api.adjustStock(shop.id, p!.id, mode, n); setQty(''); await prodQ.reload(); }
        catch (e: any) { Alert.alert('Stock not changed', e.message); }
        finally { setStockBusy(false); }
      } },
    ]);
  }

  async function setFlag(patch: { is_available?: boolean; is_active?: boolean }, confirmText?: string) {
    const run = async () => { try { await api.updateProduct(shop.id, id!, patch); await prodQ.reload(); } catch (e: any) { Alert.alert('Could not change', e.message); } };
    if (!confirmText) return run();
    Alert.alert('Are you sure?', confirmText, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', onPress: run }]);
  }

  if (editing && prodQ.loading && !p) return <Screen edges={['top', 'bottom']}><Header title="Product" back /><Loading /></Screen>;
  if (editing && !p) return <Screen edges={['top', 'bottom']}><Header title="Product" back /><ErrorBox message={prodQ.error ?? 'We could not open this product.'} onRetry={prodQ.reload} /></Screen>;

  const cats = catQ.data ?? [];
  const shownImg = image?.uri ?? p?.image_url ?? null;
  const priceChanged = editing && p && parseAmount(price) !== null && parseAmount(price) !== Number(p.price);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={editing ? 'Edit product' : 'New product'} back />

      <Pressable onPress={async () => { try { const r = await pickImage(); if (r) setImage(r); } catch (e: any) { Alert.alert('Photo', e.message); } }}
        accessibilityRole="button" accessibilityLabel="Choose a product picture"
        style={{ alignSelf: 'center', width: 96, height: 96, borderRadius: 22, backgroundColor: C.lavender, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 }}>
        {shownImg ? <Image source={{ uri: shownImg }} style={{ width: 96, height: 96 }} /> : <View style={{ alignItems: 'center' }}><Feather name="image" size={24} color={C.plum} /><Text style={T.small}>Add photo</Text></View>}
      </Pressable>

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Basmati rice" error={errors.name} maxLength={120} />
      <Field label="Name in Hindi (optional)" value={nameHi} onChangeText={setNameHi} placeholder="e.g. बासमती चावल" maxLength={120} />

      <Text style={[T.label, { marginBottom: 6 }]}>Sold by</Text>
      {editing ? (
        <Text style={[T.body, { marginBottom: 14 }]}>{UNIT_LABEL[unit]} <Text style={T.small}>(the unit cannot be changed after the product is created)</Text></Text>
      ) : (
        <ChipRow>{UNITS.map((u) => <Chip key={u} label={UNIT_LABEL[u]} active={unit === u} onPress={() => setUnit(u)} />)}</ChipRow>
      )}

      <Field label={`Price per ${UNIT_LABEL[unit]} (₹)`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="60" error={errors.price}
        hint={priceChanged ? 'Bills you already made keep their old price.' : undefined} />

      <Text style={[T.label, { marginBottom: 6 }]}>Category</Text>
      <ChipRow>
        <Chip label="None" active={catId === null} onPress={() => setCatId(null)} />
        {cats.map((c) => <Chip key={c.id} label={c.name} active={catId === c.id} onPress={() => setCatId(c.id)} />)}
      </ChipRow>

      {!editing ? <Field label={`Stock you have now (${UNIT_LABEL[unit]})`} value={stock} onChangeText={setStock} keyboardType="decimal-pad" placeholder="0" error={errors.stock} /> : null}
      <Field label={`Warn me when stock is ${formatQty(parseQty(low || '0') ?? 0)} ${UNIT_LABEL[unit]} or less`} value={low} onChangeText={setLow} keyboardType="decimal-pad" error={errors.low} />

      <Btn label={editing ? 'Save changes' : 'Add product'} onPress={save} loading={busy} />

      {editing && p ? (
        <>
          <Card style={{ marginTop: 26 }}>
            <Text style={T.h3}>Stock</Text>
            <Text style={{ fontFamily: F.bodyHeavy, fontSize: 30, lineHeight: 40, color: p.stock_quantity <= p.low_stock_threshold ? C.gulabiDeep : C.ink }}>
              {formatQty(p.stock_quantity)} <Text style={T.small}>{UNIT_LABEL[p.unit]} · {rupees(p.price)} each</Text>
            </Text>
            <ChipRow>
              <Chip label="Add stock" active={mode === 'add'} onPress={() => setMode('add')} />
              <Chip label="Take out" active={mode === 'reduce'} onPress={() => setMode('reduce')} />
              <Chip label="Set exact" active={mode === 'set'} onPress={() => setMode('set')} />
            </ChipRow>
            <Field label={mode === 'set' ? 'New stock' : 'Quantity'} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="0" />
            <Btn label="Update stock" variant="soft" onPress={applyStock} loading={stockBusy} />
            <Text style={[T.small, { marginTop: 8 }]}>Selling reduces stock automatically when you make a bill.</Text>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={T.h3}>Available to customers</Text>
                <Text style={T.small}>Turn off to show "Out of stock".</Text>
              </View>
              <Switch value={p.is_available} onValueChange={(v) => setFlag({ is_available: v })} trackColor={{ true: C.pista, false: C.line }} thumbColor={p.is_available ? C.pistaDeep : '#fff'} />
            </View>
          </Card>

          <View style={{ marginTop: 16 }}>
            {p.is_active ? (
              <Btn label="Hide this product" variant="danger" onPress={() => setFlag({ is_active: false }, 'Customers will no longer see it. Your old bills are not affected. You can show it again later.')} />
            ) : (
              <Btn label="Show this product again" variant="soft" onPress={() => setFlag({ is_active: true })} />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
