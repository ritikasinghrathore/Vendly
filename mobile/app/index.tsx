import React from 'react';
import { View } from 'react-native';
import { C } from '../src/theme';

// The gate in _layout.tsx sends people to the right place; this is just a blank first frame.
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
