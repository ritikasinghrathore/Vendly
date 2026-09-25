import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { DancingScript_600SemiBold, DancingScript_700Bold } from '@expo-google-fonts/dancing-script';
import { Mulish_400Regular, Mulish_600SemiBold, Mulish_700Bold, Mulish_800ExtraBold } from '@expo-google-fonts/mulish';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { isConfigured } from '../src/config';
import { C, T } from '../src/theme';
import { Btn } from '../src/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

function SetupNeeded() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 28, justifyContent: 'center' }}>
      <Text style={T.h1}>One more step</Text>
      <Text style={[T.body, { marginTop: 8 }]}>
        This app is not connected to its server yet. Copy the file ".env.example" to ".env", set EXPO_PUBLIC_API_BASE_URL to your backend's address, then restart with "npx expo start -c".
      </Text>
      <Text style={[T.small, { marginTop: 12 }]}>The full steps are in README.md, section "Connect the backend".</Text>
    </View>
  );
}

function Gate() {
  const { loading, loadError, user, shops, activeShop, subscription, refresh, signOut } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const navReady = !!useRootNavigationState()?.key;
  const seg0 = segments[0];
  const seg1 = segments[1];

  useEffect(() => { if (!loading) SplashScreen.hideAsync().catch(() => {}); }, [loading]);

  useEffect(() => {
    if (loading || loadError || !navReady) return;
    const home = user?.role === 'shopkeeper' ? '/dashboard' : '/home';
    let target: string | null = null;

    if (!user) {
      if (seg1 !== 'welcome') target = '/welcome';
    } else if (user.role === 'shopkeeper' && shops.length === 0) {
      if (seg1 !== 'create-shop') target = '/create-shop';
    } else if (user.role === 'shopkeeper' && activeShop && subscription && !subscription.hasAccess) {
      if (seg0 !== 'subscribe') target = '/subscribe';
    } else if (!seg0 || seg0 === '(auth)' || seg0 === 'auth' || seg0 === 'subscribe') {
      target = home;
    } else if (user.role === 'shopkeeper' && seg0 === '(customer)') {
      target = home;
    } else if (user.role === 'customer' && seg0 === '(shop)') {
      target = home;
    }
    if (target) router.replace(target as any);
  }, [loading, loadError, navReady, user, shops.length, activeShop?.id, subscription?.hasAccess, seg0, seg1]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }} />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={C.plum} size="large" />
        </View>
      ) : null}
      {!loading && loadError ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, padding: 28, justifyContent: 'center', gap: 14 }]}>
          <Text style={T.h1}>No connection</Text>
          <Text style={T.body}>{loadError}</Text>
          <Btn label="Try again" onPress={refresh} />
          <Btn label="Sign out" variant="ghost" onPress={signOut} />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    DancingScript_600SemiBold, DancingScript_700Bold,
    Mulish_400Regular, Mulish_600SemiBold, Mulish_700Bold, Mulish_800ExtraBold,
  });
  const ready = loaded || !!fontError;

  useEffect(() => { if (ready && !isConfigured) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;
  if (!isConfigured) return <SetupNeeded />;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Gate />
    </AuthProvider>
  );
}
