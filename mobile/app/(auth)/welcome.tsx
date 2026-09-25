import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { C, F, T } from '../../src/theme';
import { Marquee, Typewriter } from '../../src/components/motion';
import { PRIVACY_URL, TERMS_URL } from '../../src/config';

const RIBBON = ['Kirana', 'Puja samagri', 'Doodh', 'Sabzi', 'Stationery', 'Dawai', 'Ghar ka saaman'];

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: C.lavender }}>
      <View style={{ position: 'absolute', top: -60, right: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: C.gulabi }} />
      <View style={{ position: 'absolute', top: 210, left: -90, width: 200, height: 200, borderRadius: 100, backgroundColor: C.butter, opacity: 0.8 }} />
      <View style={{ position: 'absolute', top: 120, right: 30, width: 70, height: 70, borderRadius: 35, backgroundColor: C.pista }} />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 26, justifyContent: 'center' }}>
          <Typewriter text="Vendly" style={T.hero} speed={140} delay={400} />
          <Text style={[T.h2, { marginTop: 4 }]}>One platform for</Text>
          <Text style={{ fontFamily: F.display, fontSize: 36, lineHeight: 48, color: C.plum }}>customers and shopkeepers.</Text>
        </View>
        <View style={{ backgroundColor: C.plum, paddingVertical: 12 }}>
          <Marquee items={RIBBON} style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.lavender }} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.bg, borderTopLeftRadius: 34, borderTopRightRadius: 10, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 }}>
        <Text style={[T.label, { marginBottom: 12 }]}>Choose your account</Text>

        <RoleCard
          icon="shopping-bag" color={C.pista} iconColor={C.pistaDeep} title="Customer" price="Free"
          text="Browse shops, compare prices, send a shopping list, and keep your khata in one place."
          onPress={() => router.push('/auth?role=customer')}
        />
        <RoleCard
          icon="home" color={C.butter} iconColor={C.butterDeep} title="Shopkeeper" price="₹1,000/month"
          text="List your items and prices, receive shopping lists, bill accurately and track every rupee owed."
          onPress={() => router.push('/auth?role=shopkeeper')}
        />

        <Text style={[T.small, { textAlign: 'center', marginTop: 6 }]}>
          By continuing you agree to the{' '}
          <Text style={{ textDecorationLine: 'underline' }} onPress={() => TERMS_URL && Linking.openURL(TERMS_URL)}>Terms</Text>
          {' '}and{' '}
          <Text style={{ textDecorationLine: 'underline' }} onPress={() => PRIVACY_URL && Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>.
        </Text>
      </SafeAreaView>
    </View>
  );
}

function RoleCard({ icon, color, iconColor, title, price, text, onPress }: {
  icon: React.ComponentProps<typeof Feather>['name']; color: string; iconColor: string; title: string; price: string; text: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Continue as ${title}`}
      style={({ pressed }) => ({ backgroundColor: color, borderRadius: 22, padding: 16, marginBottom: 12, flexDirection: 'row', gap: 14, alignItems: 'center', opacity: pressed ? 0.88 : 1 })}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: F.bodyHeavy, fontSize: 17, color: C.ink }}>{title}</Text>
          <Text style={{ fontFamily: F.bodyHeavy, fontSize: 14, color: iconColor }}>{price}</Text>
        </View>
        <Text style={[T.small, { marginTop: 2 }]}>{text}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={C.inkSoft} />
    </Pressable>
  );
}
