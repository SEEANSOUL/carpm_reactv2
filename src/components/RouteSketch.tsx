import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '../theme/colors';

type Point = { latitude: number; longitude: number };

type Props = {
  points: Point[];
  height?: number;
  fill?: boolean;
  variant?: 'panel' | 'story';
};

function thinPoints(points: Point[], max = 420): Point[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const result: Point[] = [];
  for (let i = 0; i < max; i += 1) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}

export function RouteSketch({ points, height = 220, fill = false, variant = 'panel' }: Props) {
  const story = variant === 'story';
  const drawHeight = fill && !story ? 360 : height;

  const geometry = useMemo(() => {
    const source = thinPoints(points);
    if (source.length === 0) return null;
    const lats = source.map((point) => point.latitude);
    const lngs = source.map((point) => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const latScale = 1;
    const lngScale = Math.cos((midLat * Math.PI) / 180);
    const xSpan = Math.max((maxLng - minLng) * lngScale, 0.00015);
    const ySpan = Math.max((maxLat - minLat) * latScale, 0.00015);
    const pad = story ? 16 : 22;
    const inner = 280;
    const scale = inner / Math.max(xSpan, ySpan);
    const width = xSpan * scale + pad * 2;
    const boxHeight = ySpan * scale + pad * 2;
    const coords = source.map((point) => ({
      x: pad + (point.longitude - minLng) * lngScale * scale,
      y: pad + (maxLat - point.latitude) * latScale * scale,
    }));
    return { width, boxHeight, coords };
  }, [points, story]);

  if (!geometry || geometry.coords.length === 0) {
    return (
      <View style={[styles.empty, story && styles.storyEmpty, fill ? styles.fill : { height: drawHeight }]}>
        <Text style={styles.emptyText}>{story ? 'Rota çizilemedi' : 'Konum bekleniyor'}</Text>
      </View>
    );
  }

  const start = geometry.coords[0];
  const end = geometry.coords[geometry.coords.length - 1];
  const line = geometry.coords.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <View style={[styles.wrap, story && styles.storyWrap, fill ? styles.fill : { height: drawHeight }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${geometry.width} ${geometry.boxHeight}`}>
        {geometry.coords.length > 1 ? (
          <>
            {story ? (
              <Polyline
                points={line}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={10}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            <Polyline
              points={line}
              fill="none"
              stroke="rgba(225,6,0,0.35)"
              strokeWidth={story ? 14 : 8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Polyline
              points={line}
              fill="none"
              stroke={colors.drive}
              strokeWidth={story ? 5.5 : 4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : null}
        <Circle cx={start.x} cy={start.y} r={story ? 7 : 5} fill={colors.white} />
        <Circle cx={end.x} cy={end.y} r={story ? 7 : 5} fill={colors.drive} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.driveCharcoal, overflow: 'hidden' },
  storyWrap: { backgroundColor: 'transparent' },
  fill: { flex: 1 },
  empty: {
    backgroundColor: colors.driveCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyEmpty: { backgroundColor: 'transparent' },
  emptyText: { color: colors.textMuted, fontWeight: '600' },
});
