import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

function initialsFrom(name?: string | null) {
  const t = (name ?? '').trim();
  if (!t) return null;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

/** Stok foto yok — gerçek avatar yoksa baş harf / person ikonu. */
export function UserAvatar({ uri, name, size = 40, style, imageStyle }: Props) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const url = uri?.trim();

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[dim, styles.img, imageStyle]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={100}
      />
    );
  }

  const initials = initialsFrom(name);
  return (
    <View style={[dim, styles.fallback, style]}>
      {initials ? (
        <Text style={[styles.initials, { fontSize: Math.max(11, size * 0.34) }]}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={size * 0.45} color={colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initials: {
    color: colors.text,
    fontWeight: '800',
  },
});
