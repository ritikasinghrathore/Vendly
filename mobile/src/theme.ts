// Every colour, font and shape lives here. To restyle the whole app, change this one file.
export const C = {
  bg: '#FBF4F7',        // gulal mist
  card: '#FFFFFF',
  ink: '#33223F',       // aubergine ink
  inkSoft: '#6E5C7B',
  line: '#EADDEC',
  plum: '#5E3C7A',      // jamun - main action colour
  plumDeep: '#472B5E',
  pista: '#CDE7D2',
  pistaDeep: '#2F7A52',
  lavender: '#DDD4F2',
  butter: '#F7E9B0',
  butterDeep: '#8A6A12',
  gulabi: '#F5D0DC',
  gulabiDeep: '#B4425A',
  sky: '#CFE3F3',
  peach: '#F9DCCB',
  white: '#FFFFFF',
} as const;

export const PASTELS = [C.pista, C.lavender, C.butter, C.gulabi, C.sky, C.peach] as const;

// Calligraphy for titles and shop names, a soft rounded sans for everything you have to read fast (prices, forms).
export const F = {
  display: 'DancingScript_700Bold',
  displayMed: 'DancingScript_600SemiBold',
  body: 'Mulish_400Regular',
  bodyMed: 'Mulish_600SemiBold',
  bodyBold: 'Mulish_700Bold',
  bodyHeavy: 'Mulish_800ExtraBold',
} as const;

// The "petal": two opposite corners are round, two are tight. Used on the important cards.
export const petal = {
  borderTopLeftRadius: 30, borderTopRightRadius: 10,
  borderBottomRightRadius: 30, borderBottomLeftRadius: 10,
} as const;
export const petalFlip = {
  borderTopLeftRadius: 10, borderTopRightRadius: 30,
  borderBottomRightRadius: 10, borderBottomLeftRadius: 30,
} as const;

export const T = {
  hero:  { fontFamily: F.display, fontSize: 58, lineHeight: 72, color: C.plum },
  h1:    { fontFamily: F.display, fontSize: 38, lineHeight: 50, color: C.ink },
  h2:    { fontFamily: F.display, fontSize: 28, lineHeight: 38, color: C.ink },
  h3:    { fontFamily: F.bodyHeavy, fontSize: 16, lineHeight: 22, color: C.ink },
  body:  { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.ink },
  small: { fontFamily: F.bodyMed, fontSize: 13, lineHeight: 18, color: C.inkSoft },
  label: { fontFamily: F.bodyBold, fontSize: 14, lineHeight: 20, color: C.ink },
} as const;

export function pastelFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PASTELS[h % PASTELS.length];
}
