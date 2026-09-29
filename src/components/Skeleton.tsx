import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radii } from '../theme/colors';

type BoneProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Yanıp sönen antrasit kemik */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = radii.sm,
  style,
}: BoneProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.95],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: '#1C1C1C',
          opacity,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '#2A2A2A',
        },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 40, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return <Skeleton width={size} height={size} radius={size / 2} style={style} />;
}

export function SkeletonLine({
  width = '100%',
  height = 12,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Skeleton width={width} height={height} radius={radii.full} style={style} />;
}

export function SkeletonCard({
  height = 120,
  style,
  children,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { minHeight: height }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    overflow: 'hidden',
  },
});
