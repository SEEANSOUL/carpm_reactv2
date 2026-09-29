import React from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Skeleton, SkeletonCard, SkeletonCircle, SkeletonLine } from './Skeleton';
import { colors, radii, spacing } from '../theme/colors';

/** Shots feed — tam ekran silüet */
export function ShotsFeedSkeleton() {
  const { height } = useWindowDimensions();
  const h = Math.max(480, height - 120);

  return (
    <View style={[styles.shotsRoot, { height: h }]}>
      <Skeleton width="100%" height={h} radius={0} style={styles.shotsBg} />
      <View style={styles.shotsRail}>
        <SkeletonCircle size={48} />
        <SkeletonCircle size={36} />
        <SkeletonCircle size={36} />
        <SkeletonCircle size={36} />
        <SkeletonCircle size={36} />
      </View>
      <View style={styles.shotsBottom}>
        <SkeletonLine width="40%" height={14} />
        <SkeletonLine width="75%" height={12} style={{ marginTop: 8 }} />
        <SkeletonLine width="55%" height={12} style={{ marginTop: 6 }} />
        <Skeleton width="70%" height={44} radius={radii.md} style={{ marginTop: 14 }} />
      </View>
    </View>
  );
}

/** Kulüpler listesi */
export function ClubsFeedSkeleton() {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.pad}
      showsVerticalScrollIndicator={false}
    >
      <SkeletonLine width="35%" height={10} />
      <View style={styles.chipRow}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={72} height={32} radius={radii.full} />
        ))}
      </View>
      <SkeletonCard height={180} style={{ padding: 0, marginTop: spacing.md }}>
        <Skeleton width="100%" height={180} radius={radii.xl} />
      </SkeletonCard>
      <SkeletonLine width="40%" height={12} style={{ marginTop: spacing.xl }} />
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} height={88} style={styles.rowCard}>
          <View style={styles.row}>
            <Skeleton width={72} height={72} radius={radii.md} />
            <View style={styles.rowBody}>
              <SkeletonLine width="55%" height={14} />
              <SkeletonLine width="80%" height={10} style={{ marginTop: 8 }} />
              <SkeletonLine width="35%" height={10} style={{ marginTop: 8 }} />
            </View>
          </View>
        </SkeletonCard>
      ))}
    </ScrollView>
  );
}

/** Garaj araç kartları */
export function GarageListSkeleton() {
  return (
    <View style={styles.pad}>
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} height={200} style={{ padding: 0, marginBottom: spacing.md }}>
          <Skeleton width="100%" height={140} radius={0} />
          <View style={{ padding: 14 }}>
            <SkeletonLine width="50%" height={14} />
            <SkeletonLine width="30%" height={10} style={{ marginTop: 8 }} />
          </View>
        </SkeletonCard>
      ))}
    </View>
  );
}

/** Profil */
export function ProfileSkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHead}>
        <SkeletonCircle size={88} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="40%" height={12} style={{ marginTop: 8 }} />
          <SkeletonLine width="80%" height={10} style={{ marginTop: 10 }} />
        </View>
      </View>
      <View style={styles.statRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.statBox}>
            <SkeletonLine width="50%" height={16} />
            <SkeletonLine width="70%" height={10} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
      <SkeletonLine width="30%" height={12} style={{ marginTop: spacing.lg }} />
      <View style={styles.grid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} width="31%" height={110} radius={radii.md} style={{ marginBottom: 8 }} />
        ))}
      </View>
    </ScrollView>
  );
}

/** Bildirim / yorum listesi */
export function ListRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.pad}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonCircle size={44} />
          <View style={styles.rowBody}>
            <SkeletonLine width="70%" height={12} />
            <SkeletonLine width="45%" height={10} style={{ marginTop: 8 }} />
          </View>
          <SkeletonLine width={28} height={10} />
        </View>
      ))}
    </View>
  );
}

/** Kulüp detay */
export function ClubDetailSkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <Skeleton width="100%" height={160} radius={radii.xl} />
      <SkeletonLine width="55%" height={18} style={{ marginTop: spacing.lg }} />
      <SkeletonLine width="90%" height={12} style={{ marginTop: 10 }} />
      <SkeletonLine width="70%" height={12} style={{ marginTop: 8 }} />
      <View style={styles.chipRow}>
        <Skeleton width={100} height={36} radius={radii.full} />
        <Skeleton width={100} height={36} radius={radii.full} />
      </View>
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} height={96} style={styles.rowCard}>
          <SkeletonLine width="40%" height={12} />
          <SkeletonLine width="90%" height={10} style={{ marginTop: 10 }} />
          <SkeletonLine width="65%" height={10} style={{ marginTop: 8 }} />
        </SkeletonCard>
      ))}
    </ScrollView>
  );
}

/** Form / create ekranları */
export function FormScreenSkeleton() {
  return (
    <View style={styles.pad}>
      <Skeleton width="100%" height={220} radius={radii.xl} />
      <SkeletonCard height={80} style={styles.rowCard}>
        <SkeletonLine width="40%" height={12} />
        <View style={[styles.chipRow, { marginTop: 12 }]}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width={88} height={64} radius={radii.md} />
          ))}
        </View>
      </SkeletonCard>
      <SkeletonCard height={72} style={styles.rowCard}>
        <SkeletonLine width="30%" height={12} />
        <SkeletonLine width="100%" height={36} style={{ marginTop: 10 }} />
      </SkeletonCard>
      <SkeletonCard height={100} style={styles.rowCard}>
        <SkeletonLine width="25%" height={12} />
        <SkeletonLine width="100%" height={60} style={{ marginTop: 10 }} />
      </SkeletonCard>
    </View>
  );
}

/** Medya upload kutusu içi */
export function MediaBoxSkeleton({ height = 280 }: { height?: number }) {
  return (
    <View style={[styles.mediaBox, { height }]}>
      <Skeleton width="42%" height={12} />
      <Skeleton width="28%" height={10} style={{ marginTop: 10 }} />
      <View style={styles.mediaBars}>
        <Skeleton width="100%" height={8} radius={radii.full} />
        <Skeleton width="78%" height={8} radius={radii.full} />
        <Skeleton width="56%" height={8} radius={radii.full} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  shotsRoot: {
    width: '100%',
    backgroundColor: colors.black,
    overflow: 'hidden',
  },
  shotsBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121212',
  },
  shotsRail: {
    position: 'absolute',
    right: 14,
    bottom: 140,
    alignItems: 'center',
    gap: 16,
  },
  shotsBottom: {
    position: 'absolute',
    left: 16,
    right: 80,
    bottom: 28,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  rowCard: { marginTop: spacing.md },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowBody: { flex: 1 },
  profileHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  statRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  gridItem: { marginBottom: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mediaBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: spacing.xl,
  },
  mediaBars: {
    width: '70%',
    marginTop: spacing.lg,
    gap: 8,
  },
});
