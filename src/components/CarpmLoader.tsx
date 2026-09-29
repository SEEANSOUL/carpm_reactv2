import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Tone = 'accent' | 'light' | 'dark';

type Props = {
  size?: Size;
  tone?: Tone;
  label?: string;
  /** Media kutusu / tam ekran kaplama */
  overlay?: boolean;
  /** Boot / boş sayfa ortası */
  screen?: boolean;
};

const SIZE_MAP: Record<Size, number> = {
  sm: 16,
  md: 24,
  lg: 36,
  xl: 52,
};

function toneColor(tone: Tone) {
  if (tone === 'light') return colors.white;
  if (tone === 'dark') return colors.black;
  return colors.accent;
}

export function CarpmLoader({
  size = 'md',
  tone = 'accent',
  label,
  overlay,
  screen,
}: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.55)).current;
  const dim = SIZE_MAP[size];
  const color = toneColor(tone);
  const track =
    tone === 'light'
      ? 'rgba(255,255,255,0.22)'
      : tone === 'dark'
        ? 'rgba(0,0,0,0.18)'
        : 'rgba(225, 6, 0, 0.22)';

  useEffect(() => {
    const rotate = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    rotate.start();
    breathe.start();
    return () => {
      rotate.stop();
      breathe.stop();
    };
  }, [spin, pulse]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ring = (
    <View style={[styles.ringWrap, { width: dim, height: dim }]}>
      <View
        style={[
          styles.track,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            borderColor: track,
            borderWidth: Math.max(2, dim * 0.08),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.arc,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            borderWidth: Math.max(2, dim * 0.08),
            borderTopColor: color,
            borderRightColor: color,
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate }],
          },
        ]}
      />
      {size !== 'sm' ? (
        <Animated.View
          style={[
            styles.core,
            {
              width: dim * 0.22,
              height: dim * 0.22,
              borderRadius: dim,
              backgroundColor: color,
              opacity: pulse,
            },
          ]}
        />
      ) : null}
    </View>
  );

  const body = (
    <View style={styles.col}>
      {ring}
      {label ? (
        <Text
          style={[
            styles.label,
            tone === 'light' && styles.labelLight,
            tone === 'dark' && styles.labelDark,
            size === 'sm' && styles.labelSm,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );

  if (overlay) {
    return (
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayCard}>
          {ring}
          <Text style={styles.overlayLabel}>{label || 'Yükleniyor…'}</Text>
        </View>
      </View>
    );
  }

  if (screen) {
    return (
      <View style={styles.screen}>
        <View style={styles.brandMark}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>CaRPM</Text>
        </View>
        {ring}
        <Text style={styles.screenLabel}>{label || 'Hazırlanıyor…'}</Text>
      </View>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  col: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
  },
  arc: {
    position: 'absolute',
  },
  core: {
    position: 'absolute',
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelSm: { fontSize: 11 },
  labelLight: { color: 'rgba(255,255,255,0.85)' },
  labelDark: { color: 'rgba(0,0,0,0.7)' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,5,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  overlayCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 140,
  },
  overlayLabel: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  brandText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 1,
  },
  screenLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
});
