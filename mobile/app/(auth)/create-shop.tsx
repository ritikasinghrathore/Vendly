import React from 'react';
import { Text } from 'react-native';
import { Header, Screen } from '../../src/components/ui';
import { ShopForm } from '../../src/components/ShopForm';
import { useAuth } from '../../src/lib/auth';
import { T } from '../../src/theme';

export default function CreateShop() {
  const { refresh, signOut } = useAuth();
  return (
    <Screen>
      <Header title="Open your shop" animate />
      <Text style={[T.body, { marginBottom: 18 }]}>
        Customers will see this on the shop list. You can change it any time from Settings.
      </Text>
      <ShopForm submitLabel="Open my shop" onSaved={async () => { await refresh(); }} />
      <Text style={[T.small, { textAlign: 'center', marginTop: 18 }]} onPress={signOut}>Sign out</Text>
    </Screen>
  );
}
