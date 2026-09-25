// Moving text. Every effect switches itself off if the phone has "reduce motion" turned on.
import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import Animated, {
  Easing, FadeInDown, FadeOutUp, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withTiming,
} from 'react-native-reanimated';
import { formatRupees } from '../lib/money';

/** Writes the text out letter by letter. The unwritten part is invisible but still takes space, so nothing jumps. */
export function Typewriter({ text, style, speed = 65, delay = 250, onDone }: {
  text: string; style?: StyleProp<TextStyle>; speed?: number; delay?: number; onDone?: () => void;
}) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);
  const [n, setN] = useState(reduce ? chars.length : 0);

  useEffect(() => {
    const all = Array.from(text);
    if (reduce) { setN(all.length); return; }
    setN(0);
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setN(i);
      if (i < all.length) t = setTimeout(tick, speed);
      else onDone?.();
    };
    t = setTimeout(tick, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, delay, reduce]);

  return (
    <Text style={style} accessibilityLabel={text}>
      {chars.slice(0, n).join('')}
      <Text style={{ opacity: 0 }}>{chars.slice(n).join('')}</Text>
    </Text>
  );
}

/** Cycles through words, each one drifting in as the last drifts out. */
export function WordSwap({ words, style, interval = 2300, height = 56 }: {
  words: string[]; style?: StyleProp<TextStyle>; interval?: number; height?: number;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || words.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval, reduce]);
  return (
    <View style={{ height, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.Text key={i} entering={FadeInDown.duration(500)} exiting={FadeOutUp.duration(350)} style={style}>
        {words[i]}
      </Animated.Text>
    </View>
  );
}

/** A ribbon of text that keeps sliding past, like a shop-front banner. */
export function Marquee({ items, style, speed = 34, gap = '     ✦     ' }: {
  items: string[]; style?: StyleProp<TextStyle>; speed?: number; gap?: string;
}) {
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  const [w, setW] = useState(0);
  let base = items.join(gap) + gap;
  while (base.length < 90) base += base;

  useEffect(() => {
    if (!w || reduce) { x.value = 0; return; }
    x.value = 0;
    x.value = withRepeat(withTiming(-w, { duration: (w / speed) * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [w, speed, reduce, base]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={{ overflow: 'hidden' }} accessible accessibilityLabel={items.join(', ')}>
      <Animated.View style={[{ flexDirection: 'row', width: 30000 }, anim]}>
        <Text numberOfLines={1} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[style, { flexShrink: 0 }]}>{base}</Text>
        <Text numberOfLines={1} style={[style, { flexShrink: 0 }]}>{base}</Text>
        <Text numberOfLines={1} style={[style, { flexShrink: 0 }]}>{base}</Text>
      </Animated.View>
    </View>
  );
}

/** A number that counts up to its value. */
export function CountUp({ value, format, style, duration = 800 }: {
  value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = p >= 1 ? value : a + (value - a) * eased;
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);
  return <Text style={style}>{format(shown)}</Text>;
}

/** Rupee amount (in paise) that counts up. */
export function RupeeCount({ paise, style, sign }: { paise: number; style?: StyleProp<TextStyle>; sign?: boolean }) {
  return (
    <CountUp
      value={paise}
      style={style}
      format={(n) => formatRupees(n === paise ? n : Math.round(n / 100) * 100, { sign })}
    />
  );
}
