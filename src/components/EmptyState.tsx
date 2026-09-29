import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ListRowsSkeleton } from './ScreenSkeletons';
import { colors, radii, spacing } from '../theme/colors';

type Props = {
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  loading,
  icon = 'file-tray-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ListRowsSkeleton rows={5} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={40} color={colors.textDim} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    width: '100%',
    paddingTop: spacing.sm,
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  sub: { color: colors.textMuted, textAlign: 'center', lineHeight: 20, fontSize: 13 },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  btnText: { color: colors.black, fontWeight: '800' },
});
