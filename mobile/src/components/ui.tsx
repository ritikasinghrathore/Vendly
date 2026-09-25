import React, { ReactNode, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleProp, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C, F, T, petal, petalFlip } from '../theme';
import { Typewriter } from './motion';
import { round3 } from '../lib/format';

// ------------------------------------------------------------------ layout
export function Screen({ children, scroll = true, onRefresh, refreshing = false, edges = ['top'], contentStyle, footer }: {
  children: ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[]; contentStyle?: StyleProp<ViewStyle>; footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ padding: 20, paddingBottom: 48 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.plum} colors={[C.plum]} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20 }, contentStyle]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

export function IconBtn({ name, onPress, label, badge, color = C.plum, bg = C.lavender }: {
  name: React.ComponentProps<typeof Feather>['name']; onPress: () => void; label: string; badge?: number; color?: string; bg?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
      <Feather name={name} size={20} color={color} />
      {badge ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.gulabiDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: 10 }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Header({ title, subtitle, back, right, animate }: {
  title: string; subtitle?: string; back?: boolean; right?: ReactNode; animate?: boolean;
}) {
  const router = useRouter();
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42, marginBottom: 6 }}>
        {back ? <IconBtn name="arrow-left" label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : <View />}
        <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View>
      </View>
      {animate ? <Typewriter text={title} style={T.h1} /> : <Text style={T.h1}>{title}</Text>}
      {subtitle ? <Text style={[T.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------------ surfaces
export function Petal({ color = C.lavender, flip, style, onPress, children, label }: {
  color?: string; flip?: boolean; style?: StyleProp<ViewStyle>; onPress?: () => void; children: ReactNode; label?: string;
}) {
  const shape = flip ? petalFlip : petal;
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
        style={({ pressed }) => [{ backgroundColor: color, padding: 16, opacity: pressed ? 0.88 : 1 }, shape, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[{ backgroundColor: color, padding: 16 }, shape, style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const base: ViewStyle = { backgroundColor: C.card, borderRadius: 18, borderWidth: 1.5, borderColor: C.line, padding: 14 };
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}>{children}</Pressable>;
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Badge({ label, tone = 'plum' }: { label: string; tone?: 'plum' | 'green' | 'red' | 'gold' | 'grey' }) {
  const map = {
    plum: [C.lavender, C.plum], green: [C.pista, C.pistaDeep], red: [C.gulabi, C.gulabiDeep],
    gold: [C.butter, C.butterDeep], grey: ['#EFE9F1', C.inkSoft],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontFamily: F.bodyBold, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ controls
export function Btn({ label, onPress, variant = 'primary', icon, loading, disabled, style, small }: {
  label: string; onPress: () => void; variant?: 'primary' | 'soft' | 'ghost' | 'danger'; icon?: React.ComponentProps<typeof Feather>['name'];
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const v = {
    primary: { bg: C.plum, fg: '#fff', border: C.plum },
    soft: { bg: C.lavender, fg: C.plum, border: C.lavender },
    ghost: { bg: 'transparent', fg: C.plum, border: C.line },
    danger: { bg: C.gulabi, fg: C.gulabiDeep, border: C.gulabi },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable onPress={off ? undefined : onPress} accessibilityRole="button" accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [{
        minHeight: small ? 40 : 52, borderRadius: 26, paddingHorizontal: small ? 16 : 22, backgroundColor: v.bg, borderWidth: 1.5, borderColor: v.border,
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: off ? 0.5 : pressed ? 0.85 : 1,
      }, style]}>
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon ? <Feather name={icon} size={small ? 16 : 18} color={v.fg} /> : null}
          <Text style={{ color: v.fg, fontFamily: F.bodyBold, fontSize: small ? 14 : 16 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, hint, style, inputStyle, ...props }: TextInputProps & {
  label?: string; error?: string | null; hint?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle>;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={[T.label, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#A797B3"
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[{
          backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor: error ? C.gulabiDeep : focus ? C.plum : C.line,
          paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontFamily: F.bodyMed, fontSize: 16, color: C.ink,
          minHeight: 48, textAlignVertical: props.multiline ? 'top' : 'center',
        }, inputStyle]}
      />
      {error ? <Text style={[T.small, { color: C.gulabiDeep, marginTop: 4 }]}>{error}</Text> : hint ? <Text style={[T.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function SearchBox({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 26, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 16, minHeight: 50, marginBottom: 12 }}>
      <Feather name="search" size={18} color={C.inkSoft} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A797B3"
        style={{ flex: 1, marginLeft: 10, fontFamily: F.bodyMed, fontSize: 16, color: C.ink, paddingVertical: 10 }} autoCorrect={false} />
      {value ? <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search"><Feather name="x" size={18} color={C.inkSoft} /></Pressable> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? C.plum : color ?? C.card, borderWidth: 1.5, borderColor: active ? C.plum : C.line }}>
      <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: active ? '#fff' : C.ink }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {children}
    </ScrollView>
  );
}

export function Stepper({ value, onChange, step = 1, max, busy, unitLabel }: {
  value: number; onChange: (n: number) => void; step?: number; max?: number; busy?: boolean; unitLabel?: string;
}) {
  const btn = (name: 'plus' | 'minus', onPress: () => void, off?: boolean) => (
    <Pressable onPress={off || busy ? undefined : onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={name === 'plus' ? 'More' : 'Less'}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: name === 'plus' ? C.plum : C.lavender, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.4 : 1 }}>
      <Feather name={name} size={18} color={name === 'plus' ? '#fff' : C.plum} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {btn('minus', () => onChange(Math.max(0, round3(value - step))))}
      <Text style={{ minWidth: 44, textAlign: 'center', fontFamily: F.bodyHeavy, fontSize: 15, color: C.ink }}>
        {round3(value)}{unitLabel ? ` ${unitLabel}` : ''}
      </Text>
      {btn('plus', () => onChange(round3(value + step)), max !== undefined && value + step > max)}
    </View>
  );
}

// ------------------------------------------------------------------ feedback
export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={C.plum} size="large" />
      {label ? <Text style={T.small}>{label}</Text> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Petal color={C.gulabi} style={{ marginVertical: 12 }}>
      <Text style={[T.body, { color: C.gulabiDeep, fontFamily: F.bodyBold }]}>{message}</Text>
      {onRetry ? <View style={{ marginTop: 10 }}><Btn label="Try again" onPress={onRetry} variant="danger" small /></View> : null}
    </Petal>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12, gap: 6 }}>
      <Typewriter text={title} style={[T.h2, { textAlign: 'center' }]} delay={150} />
      {text ? <Text style={[T.body, { textAlign: 'center', color: C.inkSoft }]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

export const Divider = () => <View style={{ height: 1.5, backgroundColor: C.line, marginVertical: 10 }} />;

export function Row({ left, right, bold, style }: { left: string; right: string; bold?: boolean; style?: StyleProp<ViewStyle> }) {
  const f = bold ? F.bodyHeavy : F.bodyMed;
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 }, style]}>
      <Text style={{ fontFamily: f, fontSize: 15, color: C.ink, flexShrink: 1 }}>{left}</Text>
      <Text style={{ fontFamily: f, fontSize: 15, color: C.ink }}>{right}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ sheets
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(51,34,63,0.45)' }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 10, padding: 20, paddingBottom: 32, maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={T.h2}>{title}</Text>
            <IconBtn name="x" label="Close" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Every money action passes through this "are you sure" sheet, showing exactly what will be saved. */
export function ConfirmSheet({ visible, title, rows, confirmLabel, onConfirm, onCancel, busy, children }: {
  visible: boolean; title: string; rows: { left: string; right: string; bold?: boolean }[]; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; busy?: boolean; children?: ReactNode;
}) {
  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onCancel} title={title}>
      <Card style={{ marginBottom: 16 }}>
        {rows.map((r, i) => <Row key={i} left={r.left} right={r.right} bold={r.bold} />)}
      </Card>
      {children}
      <View style={{ gap: 10 }}>
        <Btn label={confirmLabel} onPress={onConfirm} loading={busy} />
        <Btn label="Go back" variant="ghost" onPress={onCancel} disabled={busy} />
      </View>
    </Sheet>
  );
}

export const Spacer = ({ h = 12 }: { h?: number }) => <View style={{ height: h }} />;
