import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Pressable,
  RefreshControl,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../components/EmptyState';
import { GarageListSkeleton } from '../components/ScreenSkeletons';
import { UserAvatar } from '../components/UserAvatar';
import {
  fetchMyVehicles,
  fetchProfile,
  isFollowing,
  toggleFollow,
} from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import type { Profile, Vehicle } from '../types/models';
import { formatCount } from '../utils/format';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'UserGarage'>;

export function UserGarageScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { user } = useAuth();
  const isOwn = user?.id === userId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, v] = await Promise.all([
        fetchProfile(userId),
        fetchMyVehicles(userId),
      ]);
      setProfile(p);
      setVehicles(v);
      if (user && user.id !== userId) {
        setFollowing(await isFollowing(user.id, userId).catch(() => false));
      } else {
        setFollowing(false);
      }
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggleFollow() {
    if (!user || isOwn) return;
    try {
      await toggleFollow(user.id, userId, following);
      setFollowing((f) => !f);
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  const name = profile?.full_name || profile?.username || 'Pilot';
  const handle = profile?.username || 'pilot';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          @{handle} · Garaj
        </Text>
        <View style={{ width: 24 }} />
      </View>

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
        <View style={styles.profileBlock}>
          <UserAvatar
            uri={profile?.avatar_url}
            name={name}
            size={88}
          />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            {profile?.is_verified ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.blue} />
            ) : null}
          </View>
          <Text style={styles.handle}>
            @{handle}
            {profile?.title ? ` · ${profile.title}` : ''}
          </Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>
                {profile?.vehicle_count ?? vehicles.length}
              </Text>
              <Text style={styles.statLabel}>ARAÇ</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>
                {formatCount(profile?.follower_count ?? 0)}
              </Text>
              <Text style={styles.statLabel}>TAKİPÇİ</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>
                {formatCount(profile?.like_count ?? 0)}
              </Text>
              <Text style={styles.statLabel}>BEĞENİ</Text>
            </View>
          </View>

          {!isOwn && user ? (
            <Pressable
              style={[styles.followBtn, following && styles.followBtnOn]}
              onPress={() => void onToggleFollow()}
            >
              <Text style={[styles.followText, following && styles.followTextOn]}>
                {following ? 'Takiptesin' : 'Takip Et'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>GARAJ</Text>

        {loading ? <GarageListSkeleton /> : null}
        {!loading && vehicles.length === 0 ? (
          <EmptyState
            icon="car-sport-outline"
            title="Garaj boş"
            subtitle="Bu pilot henüz araç eklememiş."
          />
        ) : null}

        {vehicles.map((v) => (
          <ImageBackground
            key={v.id}
            source={{
              uri:
                v.image_url ||
                'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200',
            }}
            style={styles.card}
            imageStyle={{ borderRadius: radii.xl }}
          >
            <View style={styles.overlay}>
              {v.is_active ? (
                <View style={styles.active}>
                  <Text style={styles.activeText}>AKTİF CANAVAR</Text>
                </View>
              ) : null}
              <Text style={styles.vehicleName}>
                {v.make} {v.model}
              </Text>
              <Text style={styles.meta}>
                {[
                  v.year,
                  v.hp ? `${v.hp} HP` : null,
                  v.zero_to_hundred != null ? `0-100 ${v.zero_to_hundred}s` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Text>
            </View>
          </ImageBackground>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  profileBlock: { alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  handle: { color: colors.textMuted, fontSize: 13 },
  bio: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  statItem: { alignItems: 'center' },
  statVal: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  followBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  followBtnOn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  followText: { color: colors.black, fontWeight: '800' },
  followTextOn: { color: colors.text },
  sectionTitle: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  card: { height: 200, borderRadius: radii.xl, overflow: 'hidden' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  active: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginBottom: 8,
  },
  activeText: { color: colors.accent, fontWeight: '900', fontSize: 10 },
  vehicleName: { color: colors.text, fontSize: 22, fontWeight: '800' },
  meta: { color: colors.textMuted, marginTop: 4 },
});
