import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { sweetAlert } from '../components/SweetAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { GarageListSkeleton } from '../components/ScreenSkeletons';
import { deleteVehicle, fetchMyVehicles } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { mapAuthError } from '../lib/authErrors';
import type { Vehicle } from '../types/models';
import { colors, radii, spacing } from '../theme/colors';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200';

function vehicleTitle(v: Vehicle) {
  return `${v.make} ${v.model}`.trim();
}

function vehicleSubtitle(v: Vehicle) {
  return [v.year, v.body_type, v.engine_code].filter(Boolean).join(' · ');
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function VehicleCard({
  vehicle,
  featured,
  onPress,
  onLongPress,
}: {
  vehicle: Vehicle;
  featured?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const badges = (vehicle.badges ?? []).slice(0, 3);
  const height = featured ? 280 : 210;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.cardPress}>
      <View style={[styles.card, { height }]}>
        <Image
          source={{ uri: vehicle.image_url || FALLBACK_IMG }}
          style={styles.cardImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.cardTop}>
          {vehicle.is_active ? (
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>AKTİF CANAVAR</Text>
            </View>
          ) : (
            <View />
          )}
          {vehicle.garage_number != null ? (
            <View style={styles.slotPill}>
              <Text style={styles.slotText}>#{vehicle.garage_number}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBottom}>
          {badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {badges.map((tag) => (
                <View key={tag} style={styles.badge}>
                  <Text style={styles.badgeText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {vehicleSubtitle(vehicle) ? (
            <Text style={styles.meta}>{vehicleSubtitle(vehicle)}</Text>
          ) : null}
          <Text style={[styles.name, featured && styles.nameFeatured]} numberOfLines={1}>
            {vehicleTitle(vehicle)}
          </Text>

          <View style={styles.statsRow}>
            {vehicle.hp != null ? (
              <StatChip label="HP" value={String(vehicle.hp)} />
            ) : null}
            {vehicle.zero_to_hundred != null ? (
              <StatChip label="0-100" value={`${vehicle.zero_to_hundred}s`} />
            ) : null}
            {vehicle.torque_nm != null ? (
              <StatChip label="Nm" value={String(vehicle.torque_nm)} />
            ) : null}
            {vehicle.exhaust_db != null ? (
              <StatChip label="dB" value={String(vehicle.exhaust_db)} />
            ) : null}
            {!vehicle.hp &&
            vehicle.zero_to_hundred == null &&
            vehicle.torque_nm == null &&
            vehicle.exhaust_db == null ? (
              <Text style={styles.hint}>Telemetri eklemek için dokun</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function GarageScreen() {
  const navigation = useAppNavigation();
  const { user, profile, refreshProfile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setVehicles(await fetchMyVehicles(user.id));
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void load();
    });
    void load();
    return unsub;
  }, [load, navigation]);

  const sorted = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return (a.garage_number ?? 999) - (b.garage_number ?? 999);
    });
  }, [vehicles]);

  const active = sorted.find((v) => v.is_active) ?? sorted[0] ?? null;
  const rest = active ? sorted.filter((v) => v.id !== active.id) : [];
  const totalHp = vehicles.reduce((sum, v) => sum + (v.hp ?? 0), 0);

  function onLongPress(v: Vehicle) {
    if (!user) return;
    sweetAlert(vehicleTitle(v), 'İşlem seç', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Düzenle',
        onPress: () => navigation.navigate('EditVehicle', { vehicle: v }),
      },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVehicle(v.id, user.id);
            await refreshProfile();
            void load();
          } catch (e) {
            sweetAlert('Hata', mapAuthError(e));
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader brand="CaRPM" title="Garajım" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.heroHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>SENİN PİSTİN</Text>
            <Text style={styles.headline}>Garaj</Text>
            <Text style={styles.subhead}>
              {profile?.username ? `@${profile.username}` : 'Pilot'} · dokun düzenle · uzun bas sil
            </Text>
          </View>
          <Pressable
            style={styles.arenaBtn}
            onPress={() => navigation.navigate('Arena')}
          >
            <Ionicons name="flame" size={18} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate('EditVehicle')}
          >
            <Ionicons name="add" size={22} color={colors.black} />
          </Pressable>
        </View>

        {!loading && vehicles.length > 0 ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>{vehicles.length}</Text>
              <Text style={styles.summaryLabel}>ARAÇ</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>{totalHp || '—'}</Text>
              <Text style={styles.summaryLabel}>TOPLAM HP</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>
                {vehicles.filter((v) => v.is_active).length || 0}
              </Text>
              <Text style={styles.summaryLabel}>AKTİF</Text>
            </View>
          </View>
        ) : null}

        {loading ? <GarageListSkeleton /> : null}

        {!loading && vehicles.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="car-sport-outline"
              title="Garajın boş"
              subtitle="İlk canavarını ekle — HP, 0-100 ve fotoğrafıyla vitrinlensin."
              actionLabel="Araç Ekle"
              onAction={() => navigation.navigate('EditVehicle')}
            />
          </View>
        ) : null}

        {active ? (
          <>
            <Text style={styles.sectionLabel}>
              {active.is_active ? 'VİTRİN' : 'ÖNE ÇIKAN'}
            </Text>
            <VehicleCard
              vehicle={active}
              featured
              onPress={() => navigation.navigate('EditVehicle', { vehicle: active })}
              onLongPress={() => onLongPress(active)}
            />
          </>
        ) : null}

        {rest.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>DİĞER ARAÇLAR</Text>
            {rest.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onPress={() => navigation.navigate('EditVehicle', { vehicle: v })}
                onLongPress={() => onLongPress(v)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 130, gap: spacing.md },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  kicker: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.4,
  },
  headline: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  subhead: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arenaBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  summaryVal: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 18,
  },
  summaryLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  sectionLabel: {
    color: colors.textDim,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: spacing.sm,
  },
  emptyWrap: { paddingTop: spacing.xxl },
  cardPress: { borderRadius: radii.xl },
  card: {
    width: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(225, 6, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  activeText: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  slotPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  slotText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  cardBottom: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    gap: 6,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.4,
  },
  meta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  nameFeatured: { fontSize: 28 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  statChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 58,
  },
  statValue: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: 0.4,
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
});
