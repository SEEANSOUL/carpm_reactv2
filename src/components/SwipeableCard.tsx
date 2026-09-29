import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ArenaVehicle } from '../api/carpm';
import { colors, radii, spacing } from '../theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_X = SCREEN_W * 0.28;
const OUT_X = SCREEN_W * 1.25;

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200';

type Props = {
  vehicle: ArenaVehicle;
  onSwipe: (direction: 'like' | 'pass') => void;
  /** Alttaki kart ise hafif ölçekli / dokunulmaz */
  behind?: boolean;
};

export function SwipeableCard({ vehicle, onSwipe, behind }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const locked = useSharedValue(false);

  const img = (vehicle.image_url?.trim() || FALLBACK_IMG).trim();

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    locked.value = false;
  }, [vehicle.id, translateX, translateY, locked]);

  useEffect(() => {
    void Image.prefetch(img);
  }, [img]);

  const finish = (dir: 'like' | 'pass') => {
    onSwipe(dir);
  };

  const pan = Gesture.Pan()
    .enabled(!behind)
    .onUpdate((e) => {
      if (locked.value) return;
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.18;
    })
    .onEnd((e) => {
      if (locked.value) return;
      const goRight = translateX.value > SWIPE_X || e.velocityX > 900;
      const goLeft = translateX.value < -SWIPE_X || e.velocityX < -900;

      if (goRight || goLeft) {
        locked.value = true;
        const dir = goRight ? 'like' : 'pass';
        translateX.value = withTiming(goRight ? OUT_X : -OUT_X, { duration: 220 }, () => {
          runOnJS(finish)(dir);
        });
        translateY.value = withTiming(translateY.value + 24, { duration: 220 });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-14, 0, 14],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: behind ? 0.96 : 1 },
      ],
      opacity: behind ? 0.88 : 1,
    };
  });

  const likeStamp = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [24, SWIPE_X], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        rotate: `${interpolate(translateX.value, [0, SWIPE_X], [-18, -8], Extrapolation.CLAMP)}deg`,
      },
      {
        scale: interpolate(translateX.value, [0, SWIPE_X], [0.85, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const passStamp = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_X, -24], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        rotate: `${interpolate(translateX.value, [-SWIPE_X, 0], [8, 18], Extrapolation.CLAMP)}deg`,
      },
      {
        scale: interpolate(translateX.value, [-SWIPE_X, 0], [1, 0.85], Extrapolation.CLAMP),
      },
    ],
  }));

  const body = (
    <Animated.View style={[styles.card, behind && styles.cardBehind, cardStyle]}>
      <Image
        source={{ uri: img }}
        style={styles.photo}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.25)', 'transparent', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {!behind ? (
        <>
          <Animated.View style={[styles.stamp, styles.stampLike, likeStamp]}>
            <Text style={styles.stampLikeText}>ATEŞ EDİYOR 🔥</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampPass, passStamp]}>
            <Text style={styles.stampPassText}>SIRADAKİ 🛑</Text>
          </Animated.View>
        </>
      ) : null}

      <View style={styles.topMeta} pointerEvents="none">
        {vehicle.owner ? (
          <View style={styles.ownerRow}>
            {vehicle.owner.avatar_url ? (
              <Image
                source={{ uri: vehicle.owner.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={14} color={colors.white} />
              </View>
            )}
            <Text style={styles.ownerName}>@{vehicle.owner.username}</Text>
          </View>
        ) : null}
        {vehicle.is_active ? (
          <View style={styles.activePill}>
            <Text style={styles.activeText}>AKTİF</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottom} pointerEvents="none">
        {(vehicle.badges ?? []).slice(0, 3).length > 0 ? (
          <View style={styles.badgeRow}>
            {(vehicle.badges ?? []).slice(0, 3).map((b) => (
              <View key={b} style={styles.badge}>
                <Text style={styles.badgeText}>{b}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {vehicle.make} {vehicle.model}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {[vehicle.year, vehicle.body_type, vehicle.engine_code].filter(Boolean).join(' · ') ||
            'Teknik detay yok'}
        </Text>
        <View style={styles.stats}>
          {vehicle.hp != null ? (
            <View style={styles.stat}>
              <Text style={styles.statVal}>{vehicle.hp}</Text>
              <Text style={styles.statLab}>HP</Text>
            </View>
          ) : null}
          {vehicle.zero_to_hundred != null ? (
            <View style={styles.stat}>
              <Text style={styles.statVal}>{vehicle.zero_to_hundred}s</Text>
              <Text style={styles.statLab}>0-100</Text>
            </View>
          ) : null}
          {vehicle.torque_nm != null ? (
            <View style={styles.stat}>
              <Text style={styles.statVal}>{vehicle.torque_nm}</Text>
              <Text style={styles.statLab}>Nm</Text>
            </View>
          ) : null}
          {vehicle.ecu_map ? (
            <View style={styles.stat}>
              <Text style={styles.statVal}>{vehicle.ecu_map}</Text>
              <Text style={styles.statLab}>ECU</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );

  if (behind) return body;

  return <GestureDetector gesture={pan}>{body}</GestureDetector>;
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBehind: {
    transform: [{ scale: 0.96 }],
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  stamp: {
    position: 'absolute',
    top: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 3,
    zIndex: 5,
  },
  stampLike: {
    left: 20,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
  },
  stampPass: {
    right: 20,
    borderColor: colors.accent,
    backgroundColor: 'rgba(225, 6, 0, 0.18)',
  },
  stampLikeText: {
    color: '#4ADE80',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  stampPassText: {
    color: '#FB7185',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  topMeta: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  avatarFallback: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerName: { color: colors.white, fontWeight: '700', fontSize: 13 },
  activePill: {
    backgroundColor: 'rgba(225, 6, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  activeText: { color: colors.accent, fontWeight: '900', fontSize: 10 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    gap: 6,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: { color: colors.white, fontWeight: '800', fontSize: 10 },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  stat: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 64,
  },
  statVal: { color: colors.white, fontWeight: '900', fontSize: 15 },
  statLab: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.4,
  },
});
