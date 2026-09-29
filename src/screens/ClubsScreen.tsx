import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { CountdownBoxes } from '../components/CountdownBoxes';
import { EmptyState } from '../components/EmptyState';
import { ClubsFeedSkeleton } from '../components/ScreenSkeletons';
import {
  fetchCategories,
  fetchClubs,
  fetchFeaturedClub,
  fetchLiveOrUpcomingEvents,
  fetchMyClubIds,
  joinClub,
  leaveClub,
  rsvpEvent,
  cancelRsvp,
  deleteClub,
  deleteEvent,
} from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { mapAuthError } from '../lib/authErrors';
import type { Category, Club, EventItem } from '../types/models';
import { formatMembers } from '../utils/format';
import { colors, radii, spacing } from '../theme/colors';

export function ClubsScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [featured, setFeatured] = useState<Club | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myClubIds, setMyClubIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const [cats, clubList, feat, evs, memberIds] = await Promise.all([
        fetchCategories().catch(() => [] as Category[]),
        fetchClubs(activeCat),
        fetchFeaturedClub(),
        fetchLiveOrUpcomingEvents(),
        fetchMyClubIds(user.id).catch(() => [] as string[]),
      ]);
      setCategories(
        cats.length
          ? cats
          : [
              { id: 'all', slug: 'all', name: 'Tümü' },
            ],
      );
      setClubs(clubList);
      setFeatured(feat);
      setMyClubIds(memberIds);
      // Buluşmalar yalnızca üye olunan kulüplerde görünür
      const memberSet = new Set(memberIds);
      setEvents(
        (evs ?? []).filter((e) => !!e.club_id && memberSet.has(e.club_id)),
      );
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCat, user]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.location ?? '').toLowerCase().includes(q),
    );
  }, [clubs, query]);

  const memberSet = useMemo(() => new Set(myClubIds), [myClubIds]);

  const liveEvent =
    events.find((e) => e.is_live) ||
    events.find((e) => e.event_type === 'convoy') ||
    null;
  const trackEvent =
    events.find((e) => e.event_type === 'track_day') ||
    events.find((e) => e.track_id) ||
    events.find((e) => !e.is_live) ||
    null;

  const isFeaturedMember = !!(featured && memberSet.has(featured.id));
  // Hero’daki buluşma kartı: featured kulübe üye + etkinlik aynı kulüpte
  const featuredLiveEvent =
    isFeaturedMember && liveEvent && liveEvent.club_id === featured?.id
      ? liveEvent
      : null;

  async function onJoinClub(clubId: string) {
    if (!user) return;
    try {
      const status = await joinClub(clubId, user.id);
      if (status === 'pending') {
        sweetAlert('İstek gönderildi', 'Kurucu onaylayınca kulübe üye olursun.');
      } else {
        sweetAlert('Tamam', 'Kulübe katıldın.');
      }
      void load();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  async function onLeaveClub(clubId: string) {
    if (!user) return;
    sweetAlert('Ayrıl', 'Kulüpten ayrılmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Ayrıl',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveClub(clubId, user.id);
            void load();
          } catch (e) {
            sweetAlert('Hata', mapAuthError(e));
          }
        },
      },
    ]);
  }

  async function onRsvp(eventId: string) {
    if (!user) return;
    try {
      await rsvpEvent(eventId, user.id);
      sweetAlert('Tamam', 'Katılımın kaydedildi.');
      void load();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  async function onCancelRsvp(eventId: string) {
    if (!user) return;
    try {
      await cancelRsvp(eventId, user.id);
      sweetAlert('Tamam', 'Katılım iptal edildi.');
      void load();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  function onClubActions(club: Club) {
    const isOwner = !!user && club.created_by === user.id;
    const isMember = memberSet.has(club.id);
    sweetAlert(club.name, 'İşlem seç', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kulübe gir',
        onPress: () => navigation.navigate('ClubDetail', { clubId: club.id }),
      },
      ...(isMember
        ? [
            {
              text: 'Ayrıl',
              style: 'destructive' as const,
              onPress: () => void onLeaveClub(club.id),
            },
          ]
        : [
            {
              text: 'Katıl',
              onPress: () => void onJoinClub(club.id),
            },
          ]),
      ...(isOwner
        ? [
            {
              text: 'Etkinlik oluştur',
              onPress: () =>
                navigation.navigate('CreateEvent', { clubId: club.id }),
            },
            {
              text: 'Kulübü sil',
              style: 'destructive' as const,
              onPress: () => {
                sweetAlert('Sil', 'Kulüp silinsin mi?', [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await deleteClub(club.id);
                        void load();
                      } catch (e) {
                        sweetAlert('Hata', mapAuthError(e));
                      }
                    },
                  },
                ]);
              },
            },
          ]
        : []),
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader brand="CaRPM" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textDim} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Kulüp, buluşma veya şehir ara..."
              placeholderTextColor={colors.textDim}
              style={styles.searchInput}
            />
          </View>
        </View>

        <View style={styles.crudRow}>
          <Pressable
            style={styles.crudBtn}
            onPress={() => navigation.navigate('CreateClub')}
          >
            <Ionicons name="add" size={16} color={colors.black} />
            <Text style={styles.crudBtnText}>Kulüp oluştur</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {(categories.some((c) => c.slug === 'all')
            ? categories
            : [{ id: 'all', slug: 'all', name: 'Tümü' }, ...categories]
          ).map((cat) => {
            const active = cat.slug === activeCat;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setActiveCat(cat.slug)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? <ClubsFeedSkeleton /> : null}
        {error ? <EmptyState icon="warning-outline" title="Veri alınamadı" subtitle={error} /> : null}

        {!loading && !error && featured ? (
          <ImageBackground
            source={{
              uri:
                featured.banner_url ||
                'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200',
            }}
            style={styles.hero}
            imageStyle={{ borderRadius: radii.xl }}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.92)']}
              style={styles.heroGrad}
            >
              <View style={styles.badgeRow}>
                {featured.is_verified ? (
                  <View style={styles.badge}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.gold} />
                    <Text style={styles.badgeText}>Resmi Doğrulanmış Kulüp</Text>
                  </View>
                ) : null}
                {featuredLiveEvent?.is_live ? (
                  <View style={[styles.badge, styles.liveBadge]}>
                    <View style={styles.liveDot} />
                    <Text style={styles.badgeText}>Canlı Buluşma</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.heroTitle}>{featured.name}</Text>
              <Text style={styles.heroMeta}>
                {featured.location || '—'} · {formatMembers(featured.member_count)} Aktif
                Pilot
              </Text>

              {featuredLiveEvent ? (
                <View style={styles.eventCard}>
                  <View>
                    <Text style={styles.eventWhen}>
                      {featuredLiveEvent.subtitle || 'Yaklaşan'}
                    </Text>
                    <Text style={styles.eventTitle}>{featuredLiveEvent.title}</Text>
                  </View>
                  <Text style={styles.eventPilots}>
                    {featuredLiveEvent.participant_count}+ PİLOT
                  </Text>
                </View>
              ) : null}

              <View style={styles.heroActions}>
                <Pressable
                  style={styles.joinBtn}
                  onPress={() =>
                    isFeaturedMember
                      ? navigation.navigate('ClubDetail', { clubId: featured.id })
                      : onJoinClub(featured.id)
                  }
                >
                  <Text style={styles.joinText}>
                    {isFeaturedMember ? 'Kulübe Gir' : 'Kulübe Katıl'}
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
          </ImageBackground>
        ) : null}

        {!loading && !error && !featured ? (
          <EmptyState
            icon="people-outline"
            title="Henüz kulüp yok"
            subtitle="İlk kulübü sen oluştur."
            actionLabel="Kulüp Oluştur"
            onAction={() => navigation.navigate('CreateClub')}
          />
        ) : null}

        {!loading && trackEvent ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Geri Sayım: Pist Günleri</Text>
            <View style={styles.trackCard}>
              <View style={styles.trackHeader}>
                <View style={styles.trackPill}>
                  <Text style={styles.trackPillText}>{trackEvent.title}</Text>
                </View>
                <Text style={styles.trackApproved}>
                  {trackEvent.approved_vehicle_count} Araç Onaylandı
                </Text>
              </View>
              <Text style={styles.trackSubtitle}>
                {trackEvent.subtitle || trackEvent.location_name || 'Pist buluşması'}
              </Text>

              <CountdownBoxes target={new Date(trackEvent.start_time)} />

              {trackEvent.track ? (
                <View style={styles.mapRow}>
                  {trackEvent.track.map_image_url ? (
                    <Image
                      source={{ uri: trackEvent.track.map_image_url }}
                      style={styles.mapThumb}
                    />
                  ) : (
                    <View style={[styles.mapThumb, styles.mapPlaceholder]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapLabel}>
                      {trackEvent.track.route_label || trackEvent.track.name}
                    </Text>
                    {trackEvent.track.length_km != null ? (
                      <Text style={styles.mapLen}>{trackEvent.track.length_km} KM</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.trackActions}>
                <Pressable
                  style={styles.checkBtn}
                  onPress={() => onRsvp(trackEvent.id)}
                >
                  <Ionicons name="checkmark" size={18} color={colors.black} />
                  <Text style={styles.checkBtnText}>Katılıyorum</Text>
                </Pressable>
                <Pressable
                  style={styles.outlineBtn}
                  onPress={() => onCancelRsvp(trackEvent.id)}
                >
                  <Text style={styles.outlineBtnText}>Katılımı iptal</Text>
                </Pressable>
                {trackEvent.club_id && trackEvent.club?.created_by === user?.id ? (
                  <Pressable
                    onPress={() =>
                      navigation.navigate('CreateEvent', {
                        clubId: trackEvent.club_id!,
                        eventId: trackEvent.id,
                      })
                    }
                  >
                    <Ionicons name="create-outline" size={18} color={colors.white} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    sweetAlert('Etkinlik', 'Silinsin mi?', [
                      { text: 'Vazgeç', style: 'cancel' },
                      {
                        text: 'Sil',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteEvent(trackEvent.id);
                            void load();
                          } catch (e) {
                            sweetAlert('Hata', mapAuthError(e));
                          }
                        },
                      },
                    ]);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.accent} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kulüpler</Text>
            {filtered.map((club) => (
              <Pressable
                key={club.id}
                style={styles.clubRow}
                onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
              >
                {club.logo_url ? (
                  <Image source={{ uri: club.logo_url }} style={styles.clubLogo} />
                ) : (
                  <View style={[styles.clubLogo, styles.logoPlaceholder]}>
                    <Ionicons name="people" size={22} color={colors.textDim} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.clubName}>{club.name}</Text>
                  <Text style={styles.clubMeta}>
                    {formatMembers(club.member_count)} üye
                    {club.location ? ` · ${club.location}` : ''}
                    {club.tags?.length ? ` · ${club.tags.slice(0, 2).join(' · ')}` : ''}
                  </Text>
                  {club.recent_activity ? (
                    <Text style={styles.clubActivity}>{club.recent_activity}</Text>
                  ) : (
                    <Text style={styles.clubActivity}>İçeriği görmek için kulübe gir</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                <Pressable
                  style={styles.inceleBtn}
                  onPress={() => onClubActions(club)}
                >
                  <Text style={styles.inceleText}>İşlem</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 120 },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  crudRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  crudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  crudBtnText: { color: colors.black, fontWeight: '800', fontSize: 13 },
  crudBtnGhost: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  crudBtnGhostText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  chips: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.black },
  hero: {
    marginHorizontal: spacing.lg,
    minHeight: 280,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  heroGrad: { flex: 1, padding: spacing.lg, justifyContent: 'flex-end' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  liveBadge: { backgroundColor: colors.accentSoft },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  heroTitle: { color: colors.text, fontSize: 28, fontWeight: '800' },
  heroMeta: { color: colors.textMuted, marginTop: 4, marginBottom: 12 },
  eventCard: {
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  eventWhen: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  eventTitle: { color: colors.text, fontWeight: '700', marginTop: 2 },
  eventPilots: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  joinBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinText: { color: colors.black, fontWeight: '800' },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  trackCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackPill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  trackPillText: { color: colors.accent, fontWeight: '800', fontSize: 11 },
  trackApproved: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  trackSubtitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  mapRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  mapThumb: { width: 72, height: 52, borderRadius: radii.sm },
  mapPlaceholder: { backgroundColor: colors.border },
  mapLabel: { color: colors.text, fontWeight: '700' },
  mapLen: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  trackActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  outlineBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: { color: colors.text, fontWeight: '700' },
  checkBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: { color: colors.black, fontWeight: '800' },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clubLogo: { width: 56, height: 56, borderRadius: radii.md },
  logoPlaceholder: {
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubName: { color: colors.text, fontWeight: '800', fontSize: 15 },
  clubMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  clubActivity: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  inceleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inceleText: { color: colors.text, fontWeight: '700', fontSize: 12 },
});
