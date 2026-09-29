import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme/colors';

const STORAGE_KEY = 'carpm_getting_started_dismissed_v1';

type Step = {
  key: string;
  label: string;
  done: boolean;
  onPress: () => void;
};

type Props = {
  hasVehicle: boolean;
  hasShot: boolean;
  hasClub: boolean;
  onAddVehicle: () => void;
  onCreateShot: () => void;
  onBrowseClubs: () => void;
};

export function GettingStartedCard({
  hasVehicle,
  hasShot,
  hasClub,
  onAddVehicle,
  onCreateShot,
  onBrowseClubs,
}: Props) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      setDismissed(v === '1');
      setReady(true);
    });
  }, []);

  const steps: Step[] = [
    {
      key: 'vehicle',
      label: 'Garajına araç ekle',
      done: hasVehicle,
      onPress: onAddVehicle,
    },
    {
      key: 'shot',
      label: 'İlk shot’unu paylaş',
      done: hasShot,
      onPress: onCreateShot,
    },
    {
      key: 'club',
      label: 'Bir kulübe katıl',
      done: hasClub,
      onPress: onBrowseClubs,
    },
  ];

  const allDone = steps.every((s) => s.done);

  if (!ready || dismissed || allDone) return null;

  async function dismiss() {
    setDismissed(true);
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Başlangıç</Text>
          <Text style={styles.sub}>3 adımda CaRPM’e ısın</Text>
        </View>
        <Pressable onPress={() => void dismiss()} hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {steps.map((s) => (
        <Pressable
          key={s.key}
          style={styles.row}
          onPress={s.done ? undefined : s.onPress}
          disabled={s.done}
        >
          <Ionicons
            name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={s.done ? colors.success : colors.textDim}
          />
          <Text style={[styles.rowText, s.done && styles.rowDone]}>{s.label}</Text>
          {!s.done ? (
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  rowText: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 14 },
  rowDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
