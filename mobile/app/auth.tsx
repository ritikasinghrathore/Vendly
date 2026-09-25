import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, Chip, ChipRow, Field, Header, Screen } from '../src/components/ui';
import { Typewriter } from '../src/components/motion';
import { C, T } from '../src/theme';
import { useAuth } from '../src/lib/auth';
import { friendly } from '../src/lib/api';
import type { AccountType } from '../src/lib/types';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role: AccountType = params.role === 'shopkeeper' ? 'shopkeeper' : 'customer';
  const { login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (mode === 'signup' && name.trim().length < 2) return 'Please enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (password.length < 8) return 'Your password needs at least 8 characters.';
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      if (mode === 'signup') {
        await register({ name: name.trim(), email: email.trim(), password, role, phone: phone.trim() || undefined });
      } else {
        await login(email.trim(), password);
      }
    } catch (e: any) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={role === 'shopkeeper' ? 'Shopkeeper account' : 'Customer account'} back animate />
      <Text style={[T.body, { marginBottom: 16 }]}>
        {role === 'shopkeeper'
          ? "You'll set up your shop next, then subscribe to Vendly Shopkeeper Pro."
          : 'Browse shops near you and send your first shopping list.'}
      </Text>

      <ChipRow>
        <Chip label="Sign up" active={mode === 'signup'} onPress={() => setMode('signup')} />
        <Chip label="Log in" active={mode === 'login'} onPress={() => setMode('login')} />
      </ChipRow>

      {mode === 'signup' ? <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" autoCapitalize="words" /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
      {mode === 'signup' ? <Field label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="10-digit number" keyboardType="phone-pad" /> : null}
      <Field label="Password" value={password} onChangeText={setPassword} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} secureTextEntry />

      {error ? <Text style={[T.small, { color: C.gulabiDeep, marginBottom: 10 }]}>{error}</Text> : null}
      <Btn label={mode === 'signup' ? 'Create account' : 'Log in'} onPress={submit} loading={busy} />

      <Text style={[T.small, { textAlign: 'center', marginTop: 16 }]} onPress={() => router.back()}>
        Not {role === 'shopkeeper' ? 'a shopkeeper' : 'a customer'}? Go back
      </Text>
    </Screen>
  );
}
