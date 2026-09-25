import * as ImagePicker from 'expo-image-picker';

/** Lets the person choose a square picture from their gallery. Returns null if they cancel. */
export async function pickImage(): Promise<{ base64: string; mime: string; uri: string } | null> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
  });
  const a = r.assets?.[0];
  if (r.canceled || !a?.base64) return null;
  return { base64: a.base64, mime: a.mimeType ?? 'image/jpeg', uri: a.uri };
}
