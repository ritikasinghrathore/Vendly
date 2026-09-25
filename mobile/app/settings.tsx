import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, Card, Chip, ChipRow, Header, Screen, Spacer } from '../src/components/ui';
import { ShopForm } from '../src/components/ShopForm';
import { ShopAvatar } from '../src/components/shop';
import { T } from '../src/theme';
import { useAuth } from '../src/lib/auth';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../src/config';

export default function Settings() {
  const { activeShop, shops, setActiveShopId, refresh, signOut, user } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  if (!activeShop) return null;
  const shop = activeShop;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Settings" back />
      <Card style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ShopAvatar shop={shop} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={T.h3}>{shop.name}</Text>
          <Text style={T.small}>{[shop.area, shop.city].filter(Boolean).join(', ')}</Text>
          <Text style={T.small}>Signed in as {user?.email}</Text>
        </View>
      </Card>

      {shops.length > 1 ? (
        <>
          <Text style={[T.label, { marginBottom: 6 }]}>Your shops</Text>
          <ChipRow>{shops.map((s) => <Chip key={s.id} label={s.name} active={s.id === shop.id} onPress={() => setActiveShopId(s.id)} />)}</ChipRow>
        </>
      ) : null}

      {editing ? (
        <ShopForm initial={shop} submitLabel="Save shop details" onSaved={async () => { await refresh(); setEditing(false); }} />
      ) : (
        <View style={{ gap: 10 }}>
          <Btn label="Edit shop details" icon="edit-3" variant="soft" onPress={() => setEditing(true)} />
          <Btn label="Add another shop" icon="plus" variant="soft" onPress={() => router.push('/new-shop')} />
        </View>
      )}

      <Spacer h={26} />
      <View style={{ gap: 10 }}>
        {PRIVACY_URL ? <Btn label="Privacy policy" variant="ghost" onPress={() => Linking.openURL(PRIVACY_URL)} /> : null}
        {TERMS_URL ? <Btn label="Terms of use" variant="ghost" onPress={() => Linking.openURL(TERMS_URL)} /> : null}
        {SUPPORT_EMAIL ? <Btn label="Contact support / close my shop" variant="ghost" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Apni%20Dukaan%20support`)} /> : null}
        <Btn label="Sign out" variant="danger" onPress={signOut} />
      </View>
      <Text style={[T.small, { marginTop: 14, textAlign: 'center' }]}>Bills and khata records are kept permanently for your accounts' accuracy.</Text>
    </Screen>
  );
}
