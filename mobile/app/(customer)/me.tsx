import React, { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { Btn, Card, Field, Header, Screen, Spacer } from '../../src/components/ui';
import { Bell } from '../../src/components/shop';
import { T } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import * as api from '../../src/lib/api';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../../src/config';

export default function Me() {
  const { user, refresh, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(user?.name ?? ''); setPhone(user?.phone ?? ''); }, [user]);
  const dirty = name.trim() !== (user?.name ?? '') || phone.trim() !== (user?.phone ?? '');

  async function save() {
    if (name.trim().length < 2) return Alert.alert('Your name', 'Please enter your name.');
    setBusy(true);
    try { await api.updateProfile({ name: name.trim(), phone: phone.trim() || null }); await refresh(); }
    catch (e: any) { Alert.alert('Could not save', e.message); }
    finally { setBusy(false); }
  }

  function remove() {
    Alert.alert('Delete your account?', 'Your lists and notifications are erased. Shops keep the bills they already made, without your name.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: async () => {
        try { await api.deleteMyAccount(); await signOut(); }
        catch (e: any) { Alert.alert('Could not delete', e.message); }
      } },
    ]);
  }

  return (
    <Screen>
      <Header title="Me" right={<Bell />} />
      <Card style={{ marginBottom: 18 }}>
        <Text style={T.small}>Signed in as</Text>
        <Text style={T.h3}>{user?.email}</Text>
        <Text style={[T.small, { marginTop: 4 }]}>Customer account</Text>
      </Card>
      <Field label="Your name" value={name} onChangeText={setName} />
      <Field label="Phone (shops can reach you on it)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit number" />
      <Btn label="Save changes" onPress={save} loading={busy} disabled={!dirty} />
      <Spacer h={26} />
      {PRIVACY_URL ? <Btn label="Privacy policy" variant="soft" onPress={() => Linking.openURL(PRIVACY_URL)} style={{ marginBottom: 10 }} /> : null}
      {TERMS_URL ? <Btn label="Terms of use" variant="soft" onPress={() => Linking.openURL(TERMS_URL)} style={{ marginBottom: 10 }} /> : null}
      {SUPPORT_EMAIL ? <Btn label="Contact support" variant="soft" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={{ marginBottom: 10 }} /> : null}
      <Btn label="Sign out" variant="ghost" onPress={signOut} style={{ marginBottom: 10 }} />
      <Btn label="Delete my account" variant="danger" onPress={remove} />
    </Screen>
  );
}
