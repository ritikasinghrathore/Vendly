import React from 'react';
import { useRouter } from 'expo-router';
import { Header, Screen } from '../src/components/ui';
import { ShopForm } from '../src/components/ShopForm';
import { useAuth } from '../src/lib/auth';

export default function NewShop() {
  const router = useRouter();
  const { refresh, setActiveShopId } = useAuth();
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Add another shop" back />
      <ShopForm submitLabel="Add this shop" onSaved={async (s) => { await refresh(); setActiveShopId(s.id); router.replace('/dashboard'); }} />
    </Screen>
  );
}
