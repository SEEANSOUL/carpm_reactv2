import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

type Props = {
  target: Date;
};

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function useCountdown(target: Date) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / (24 * 3600 * 1000));
  const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  const secs = Math.floor((diff % (60 * 1000)) / 1000);
  return { days, hours, mins, secs };
}

export function CountdownBoxes({ target }: Props) {
  const { days, hours, mins, secs } = useCountdown(target);
  const items = [
    { label: 'GÜN', value: pad(days) },
    { label: 'SAAT', value: pad(hours) },
    { label: 'DK', value: pad(mins) },
    { label: 'SN', value: pad(secs) },
  ];

  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.label} style={styles.box}>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  box: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
});
