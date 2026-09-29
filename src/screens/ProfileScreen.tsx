import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { ProfileSkeleton } from '../components/ScreenSkeletons';
import { GettingStartedCard } from '../components/GettingStartedCard';
import { UserAvatar } from '../components/UserAvatar';
import { fetchMyVehicles, fetchUserBadges, fetchUserShots, deleteShot, fetchMyClubIds } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { mapAuthError } from '../lib/authErrors';
import { registerAndSavePushToken } from '../lib/pushNotifications';
import type { Badge, Shot, Vehicle } from '../types/models';
import { formatCount } from '../utils/format';
import { colors, radii, spacing } from '../theme/colors';

export function ProfileScreen() {
  const navigation = useAppNavigation();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userShots, setUserShots] = useState<Shot[]>([]);
  const [clubCount, setClubCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [v, b, s, clubIds] = await Promise.all([
        fetchMyVehicles(user.id),
        fetchUserBadges(user.id).catch(() => [] as Badge[]),
        fetchUserShots(user.id),
        fetchMyClubIds(user.id).catch(() => [] as string[]),
      ]);
      setVehicles(v);
      setBadges(b);
      setUserShots(s);
      setClubCount(clubIds.length);
      await refreshProfile();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  const display = {
    full_name: profile?.full_name || user?.email?.split('@')[0] || 'Pilot',
    username: profile?.username || 'pilot',
    title: profile?.title || 'YENİ PİLOT',
    bio: profile?.bio || 'Garajını ekle, shots paylaş, kulüplere katıl.',
    avatar_url: profile?.avatar_url ?? null,
    is_pro: profile?.is_pro ?? false,
    is_verified: profile?.is_verified ?? false,
    vehicle_count: profile?.vehicle_count ?? vehicles.length,
    follower_count: profile?.follower_count ?? 0,
    like_count: profile?.like_count ?? 0,
    badge_count: profile?.badge_count ?? badges.length,
  };

  async function onRegisterPush() {
    const result = await registerAndSavePushToken();
    if (result.ok) {
      sweetAlert('Bildirimler açık', 'Bu cihaz bildirim almaya hazır.');
    } else {
      sweetAlert('Bildirim kaydı', result.error || 'Şimdilik atlanabilir.');
    }
  }

  async function onSignOut() {
    sweetAlert('Çıkış yap', 'Hesabından çıkmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (e) {
            sweetAlert('Hata', mapAuthError(e));
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader brand="CaRPM" title="Profil" />
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
        {loading ? (
          <ProfileSkeleton />
        ) : (
          <>
        <GettingStartedCard
          hasVehicle={vehicles.length > 0}
          hasShot={userShots.length > 0}
          hasClub={clubCount > 0}
          onAddVehicle={() => navigation.navigate('Tabs', { screen: 'Garage' })}
          onCreateShot={() => navigation.navigate('Tabs', { screen: 'Create' })}
          onBrowseClubs={() => navigation.navigate('Tabs', { screen: 'Clubs' })}
        />

        <View style={styles.profileBlock}>
          <View style={styles.avatarWrap}>
            <UserAvatar
              uri={display.avatar_url}
              name={display.full_name}
              size={96}
            />
            {display.is_pro ? (
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{display.full_name}</Text>
            {display.is_verified ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.blue} />
            ) : null}
          </View>
          <Text style={styles.handle}>
            @{display.username} · {display.title}
          </Text>
          <Text style={styles.bio}>{display.bio}</Text>

          <View style={styles.stats}>
            {[
              [display.vehicle_count, 'ARAÇ'],
              [formatCount(display.follower_count), 'TAKİPÇİ'],
              [formatCount(display.like_count), 'BEĞENİ'],
              [display.badge_count, 'ROZET'],
            ].map(([val, label]) => (
              <View key={String(label)} style={styles.statItem}>
                <Text style={styles.statVal}>{val}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.primaryBtnText}>Profili Düzenle</Text>
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => void onRegisterPush()}>
              <Ionicons name="notifications-outline" size={18} color={colors.text} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={onSignOut} disabled={signingOut}>
              <Ionicons name="log-out-outline" size={18} color={colors.accent} />
            </Pressable>
          </View>

        </View>

        <Text style={styles.sectionTitle}>SÜRÜCÜ ROZETLERİ</Text>
        {badges.length === 0 ? (
          <EmptyState
            icon="ribbon-outline"
            title="Rozet yok"
            subtitle="Pist ve etkinliklerle rozet kazanacaksın."
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeScroll}
          >
            {badges.map((b) => (
              <View key={b.id} style={styles.badgeCard}>
                {b.icon_url ? (
                  /^https?:\/\//i.test(b.icon_url) ? (
                    <Image source={{ uri: b.icon_url }} style={styles.badgeIconImg} />
                  ) : (
                    <Text style={styles.badgeEmoji}>{b.icon_url}</Text>
                  )
                ) : (
                  <Text style={styles.badgeEmoji}>🏆</Text>
                )}
                <Text style={styles.badgeCat}>{b.category || 'ROZET'}</Text>
                <Text style={styles.badgeTitle}>{b.title}</Text>
                <Text style={styles.badgeSub}>{b.achievement_value || b.description}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>GARAJ VİTRİNİ</Text>
        {vehicles.length === 0 ? (
          <EmptyState
            icon="car-sport-outline"
            title="Garaj boş"
            subtitle="İlk aracını ekle, profilinde vitrinlensin."
            actionLabel="Araç Ekle"
            onAction={() => navigation.navigate('EditVehicle')}
          />
        ) : null}
        {vehicles.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => navigation.navigate('EditVehicle', { vehicle: v })}
          >
            <ImageBackground
              source={{
                uri:
                  v.image_url ||
                  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200',
              }}
              style={styles.vehicleHero}
              imageStyle={{ borderRadius: radii.xl }}
            >
              <View style={styles.vehicleBadges}>
                {(v.badges ?? []).map((tag) => (
                  <View key={tag} style={styles.vBadge}>
                    <Text style={styles.vBadgeText}>{tag}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.vehicleBottom}>
                <Text style={styles.vehicleMeta}>
                  {[v.year, v.body_type, v.engine_code].filter(Boolean).join(' // ')}
                </Text>
                <Text style={styles.vehicleName}>
                  {v.make} {v.model}
                </Text>
                <View style={styles.perfRow}>
                  {v.hp != null ? (
                    <View style={styles.perfBox}>
                      <Text style={styles.perfVal}>{v.hp}</Text>
                      <Text style={styles.perfUnit}>HP</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.editHint}>Düzenlemek için dokun</Text>
              </View>
            </ImageBackground>
          </Pressable>
        ))}

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>
              Shots ({userShots.length})
            </Text>
          </Pressable>
        </View>

        {userShots.length === 0 ? (
          <EmptyState
            icon="videocam-outline"
            title="Shot yok"
            subtitle="Ortadaki + ile ilk içeriğini paylaş."
            actionLabel="Shot paylaş"
            onAction={() => navigation.navigate('Tabs', { screen: 'Create' })}
          />
        ) : (
          <View style={styles.grid}>
            {userShots.map((s) => (
              <Pressable
                key={s.id}
                style={styles.gridItem}
                onLongPress={() => {
                  if (!user) return;
                  sweetAlert('Shot', 'Ne yapmak istersin?', [
                    { text: 'İptal', style: 'cancel' },
                    {
                      text: 'Sil',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await deleteShot(s.id, user.id);
                          void load();
                        } catch (e) {
                          sweetAlert('Hata', mapAuthError(e));
                        }
                      },
                    },
                  ]);
                }}
              >
                <Image
                  source={{
                    uri:
                      s.thumbnail_url ||
                      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400',
                  }}
                  style={styles.gridImg}
                />
                <View style={styles.viewBadge}>
                  <Ionicons name="play" size={10} color={colors.white} />
                  <Text style={styles.viewText}>{formatCount(s.view_count)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 120 },
  profileBlock: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  avatarWrap: { marginTop: spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  proBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  proText: { color: colors.black, fontWeight: '900', fontSize: 10 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  handle: { color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  bio: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    width: '100%',
    justifyContent: 'space-between',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statVal: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statLabel: { color: colors.textDim, fontSize: 10, marginTop: 2, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  primaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.black, fontWeight: '800' },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  badgeScroll: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  badgeCard: {
    width: 160,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  badgeEmoji: { fontSize: 28, marginBottom: 4 },
  badgeIconImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 6,
  },
  badgeCat: { color: colors.gold, fontWeight: '900', fontSize: 11 },
  badgeTitle: { color: colors.text, fontWeight: '800', marginTop: 6 },
  badgeSub: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  vehicleHero: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 240,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: radii.xl,
  },
  vehicleBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: spacing.md,
  },
  vBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  vBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  vehicleBottom: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: spacing.md,
    gap: 6,
  },
  vehicleMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  vehicleName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  perfRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  perfBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  perfVal: { color: colors.text, fontWeight: '900', fontSize: 18 },
  perfUnit: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  modRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  modChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  modText: { color: colors.textMuted, fontSize: 11 },
  editHint: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.sm },
  tabActive: { backgroundColor: colors.bgElevated },
  tabText: { color: colors.textDim, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: colors.text },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg - 2,
    marginTop: spacing.md,
  },
  gridItem: { width: '33.333%', aspectRatio: 0.72, padding: 2 },
  gridImg: { width: '100%', height: '100%', borderRadius: 4 },
  viewBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
