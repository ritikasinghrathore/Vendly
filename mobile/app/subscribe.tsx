import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { Btn, Card, Divider, Petal, Row, Screen } from '../src/components/ui';
import { Typewriter } from '../src/components/motion';
import { C, F, T } from '../src/theme';
import { useAuth } from '../src/lib/auth';
import * as api from '../src/lib/api';
import { friendly } from '../src/lib/api';

const FEATURES = [
  'Unlimited products and stock tracking',
  'Accurate billing with automatic totals',
  'Digital khata with full payment history',
  'Customer shopping lists delivered instantly',
  'Sales dashboard and daily summaries',
];

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Subscribe() {
  const { activeShop, subscription, refreshSubscription, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  // After the checkout browser closes, the webhook may take a few seconds to arrive - poll gently.
  const pollForAccess = useCallback((attemptsLeft: number) => {
    if (attemptsLeft <= 0) return;
    pollTimer.current = setTimeout(async () => {
      await refreshSubscription();
      pollTimer.current = null;
      pollForAccess(attemptsLeft - 1);
    }, 2500);
  }, [refreshSubscription]);

  async function subscribe() {
    if (!activeShop) return;
    setBusy(true);
    try {
      const { checkoutUrl } = await api.startSubscriptionCheckout(activeShop.id);
      await WebBrowser.openBrowserAsync(checkoutUrl);
      setChecking(true);
      await refreshSubscription();
      pollForAccess(6);
    } catch (e: any) {
      Alert.alert('Could not start checkout', friendly(e));
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }

  async function manualRefresh() {
    setChecking(true);
    try { await refreshSubscription(); } finally { setChecking(false); }
  }

  const status = subscription?.status ?? 'incomplete';
  const isPastDue = status === 'past_due';
  const isCancelling = status === 'cancelled' && subscription?.hasAccess;
  const isExpired = status === 'expired' || (!subscription?.hasAccess && status !== 'incomplete');

  return (
    <Screen edges={['top', 'bottom']} onRefresh={manualRefresh} refreshing={checking}>
      <View style={{ marginBottom: 8 }}>
        <Typewriter text="Vendly Shopkeeper Pro" style={T.h1} />
        <Text style={[T.body, { marginTop: 4 }]}>Subscribe to unlock shop management for {activeShop?.name ?? 'your shop'}.</Text>
      </View>

      {isPastDue ? (
        <Petal color={C.gulabi} style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: F.bodyBold, color: C.gulabiDeep }}>Your last payment did not go through</Text>
          <Text style={[T.small, { marginTop: 4 }]}>Please subscribe again to keep your access. Your shop and data are safe.</Text>
        </Petal>
      ) : isCancelling ? (
        <Petal color={C.butter} style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: F.bodyBold, color: C.butterDeep }}>Your subscription is cancelled</Text>
          <Text style={[T.small, { marginTop: 4 }]}>You keep full access until {formatDate(subscription!.accessUntil)}. It will not renew after that.</Text>
        </Petal>
      ) : isExpired ? (
        <Petal color={C.gulabi} style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: F.bodyBold, color: C.gulabiDeep }}>Your subscription has ended</Text>
          <Text style={[T.small, { marginTop: 4 }]}>Subscribe again to manage your shop. Your products, bills and khata are all still here.</Text>
        </Petal>
      ) : null}

      <Petal color={C.lavender} style={{ padding: 22, marginBottom: 16 }}>
        <Text style={T.small}>Vendly Shopkeeper Pro</Text>
        <Text style={{ fontFamily: F.bodyHeavy, fontSize: 40, lineHeight: 50, color: C.plum }}>₹1,000<Text style={{ fontSize: 16, color: C.inkSoft }}>/month</Text></Text>
        <Text style={[T.small, { marginTop: 2 }]}>Cancel anytime. Renews automatically each month.</Text>
      </Petal>

      <Card style={{ marginBottom: 20 }}>
        {FEATURES.map((f, i) => (
          <View key={f}>
            {i > 0 ? <Divider /> : null}
            <Row left={f} right="✓" />
          </View>
        ))}
      </Card>

      {!isCancelling ? (
        <Btn label={isPastDue || isExpired ? 'Subscribe again' : 'Subscribe now'} icon="lock" onPress={subscribe} loading={busy} />
      ) : (
        <Btn label="Manage billing" icon="external-link" variant="soft" onPress={subscribe} loading={busy} />
      )}
      <View style={{ marginTop: 10 }}>
        <Btn label="I've paid - check again" variant="ghost" onPress={manualRefresh} loading={checking && !busy} />
      </View>
      {checking && !busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}>
          <ActivityIndicator size="small" color={C.plum} />
          <Text style={T.small}>Waiting for payment confirmation…</Text>
        </View>
      ) : null}

      <Text style={[T.small, { textAlign: 'center', marginTop: 22 }]}>
        Payment opens in your browser and is verified by our server before access unlocks - never by this screen alone.
      </Text>
      <Text style={[T.small, { textAlign: 'center', marginTop: 14 }]} onPress={signOut}>Sign out</Text>
    </Screen>
  );
}
