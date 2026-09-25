import React, { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Btn, Chip, ChipRow, Field } from './ui';
import { C, F, T } from '../theme';
import { SHOP_TYPES } from '../lib/format';
import * as api from '../lib/api';
import { pickImage } from '../lib/pick';
import { useAuth } from '../lib/auth';
import type { Shop } from '../lib/types';

/** Used both to open a new shop and to edit an existing one. */
export function ShopForm({ initial, submitLabel, onSaved }: { initial?: Shop; submitLabel: string; onSaved: (s: Shop) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [ownerName, setOwnerName] = useState(initial?.owner_name ?? user?.name ?? '');
  const [tagline, setTagline] = useState(initial?.tagline ?? '');
  const [type, setType] = useState(initial?.shop_type ?? 'grocery');
  const [phone, setPhone] = useState(initial?.phone ?? user?.phone ?? '');
  const [address, setAddress] = useState(initial?.address_line ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  const [pin, setPin] = useState(initial?.pincode ?? '');
  const [logo, setLogo] = useState<{ base64: string; mime: string; uri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your shop name.';
    if (ownerName.trim().length < 2) e.ownerName = 'Enter the owner\'s name.';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) e.phone = 'Enter a 10-digit phone number customers can call.';
    if (!address.trim()) e.address = 'Enter the shop address.';
    if (!area.trim()) e.area = 'Enter your locality, for example "Pundag".';
    if (!city.trim()) e.city = 'Enter your city.';
    if (!state.trim()) e.state = 'Enter your state.';
    if (!/^\d{6}$/.test(pin.trim())) e.pin = 'A pincode has 6 digits.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      const input = {
        name: name.trim(), ownerName: ownerName.trim(), tagline: tagline.trim() || null, shopType: type,
        phone: phone.replace(/[^\d+]/g, '').slice(-13), addressLine: address.trim(), area: area.trim(),
        city: city.trim(), state: state.trim(), pincode: pin.trim(),
      };
      let shop = initial ? await api.updateShop(initial.id, input) : await api.createShop(input as any);
      if (logo) {
        try {
          const imageId = await api.uploadImage(logo.mime, logo.base64);
          shop = await api.updateShop(shop.id, { logoImageId: imageId });
        } catch (e: any) {
          Alert.alert('Shop saved', `${e.message}\nYou can add the picture later from Settings.`);
        }
      }
      onSaved(shop);
    } catch (e: any) {
      Alert.alert('Could not save your shop', e.message);
    } finally {
      setBusy(false);
    }
  }

  const shown = logo?.uri ?? initial?.logo_url ?? null;
  return (
    <View>
      <Pressable onPress={async () => { try { const p = await pickImage(); if (p) setLogo(p); } catch (e: any) { Alert.alert('Photo', e.message); } }}
        accessibilityRole="button" accessibilityLabel="Choose a shop picture"
        style={{ alignSelf: 'center', width: 104, height: 104, borderRadius: 52, backgroundColor: C.pista, alignItems: 'center', justifyContent: 'center', marginBottom: 18, overflow: 'hidden' }}>
        {shown ? <Image source={{ uri: shown }} style={{ width: 104, height: 104 }} /> : (
          <View style={{ alignItems: 'center' }}><Feather name="camera" size={26} color={C.pistaDeep} /><Text style={[T.small, { color: C.pistaDeep }]}>Add picture</Text></View>
        )}
      </Pressable>
      <Field label="Shop name" value={name} onChangeText={setName} placeholder="e.g. Ritika General Store" error={errors.name} maxLength={80} />
      <Field label="Owner name" value={ownerName} onChangeText={setOwnerName} placeholder="e.g. Subhod Kumar Singh" error={errors.ownerName} maxLength={80} />
      <Field label="A line about your shop (optional)" value={tagline} onChangeText={setTagline} placeholder="e.g. Groceries and puja items, near the temple" maxLength={140} />
      <Text style={[T.label, { marginBottom: 6 }]}>What do you sell?</Text>
      <ChipRow>{SHOP_TYPES.map((t) => <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />)}</ChipRow>
      <Field label="Shop phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit number" error={errors.phone} maxLength={16} />
      <Field label="Address" value={address} onChangeText={setAddress} placeholder="Near Sai Mandir" error={errors.address} />
      <Field label="Locality" value={area} onChangeText={setArea} placeholder="e.g. Pundag" error={errors.area} />
      <Field label="City" value={city} onChangeText={setCity} placeholder="e.g. Ranchi" error={errors.city} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Field style={{ flex: 1 }} label="State" value={state} onChangeText={setState} placeholder="Jharkhand" error={errors.state} />
        <Field style={{ flex: 1 }} label="Pincode" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} error={errors.pin} />
      </View>
      <Btn label={submitLabel} onPress={save} loading={busy} />
    </View>
  );
}
