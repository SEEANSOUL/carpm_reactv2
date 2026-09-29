import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Share,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { sweetAlert } from '../components/SweetAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import type {
  HandlerStateChangeEvent,
  TapGestureHandlerEventPayload,
  TapGestureHandler as TapGestureHandlerType,
} from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import { EmptyState } from '../components/EmptyState';
import { ShotsFeedSkeleton } from '../components/ScreenSkeletons';
import {
  deleteShot,
  fetchShotsFeed,
  isFollowing,
  toggleFollow,
  toggleShotBookmark,
  toggleShotLike,
  type FeedTab,
} from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { isDynoShot } from '../lib/feedAlgorithm';
import { isVideoUrl } from '../lib/mediaUrl';
import { mapAuthError } from '../lib/authErrors';
import type { Shot } from '../types/models';
import { formatCount } from '../utils/format';
import { colors, radii, spacing } from '../theme/colors';

const FEED_PAGE = 15;

function ShotVideoLayer({
  uri,
  active,
  paused,
  muted,
}: {
  uri: string;
  active: boolean;
  paused: boolean;
  muted: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!active || paused) {
      player.pause();
      return;
    }
    player.play();
  }, [active, paused, player]);

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

type FeedShot = Shot & { liked_by_me?: boolean; bookmarked_by_me?: boolean };

const EMPTY_COPY: Record<
  FeedTab,
  {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    actionLabel: string;
    actionTab: 'Create' | 'Clubs' | 'Garage' | 'Profile' | 'Shots';
  }
> = {
  following: {
    icon: 'people-outline',
    title: 'Takip feed’i boş',
    subtitle: 'Pilotları takip et; shot’ları burada kronolojik akar.',
    actionLabel: 'Kulüplere bak',
    actionTab: 'Clubs',
  },
  foryou: {
    icon: 'flame-outline',
    title: 'Henüz shot yok',
    subtitle: 'Ortadaki + butonundan ilk shot’unu paylaş.',
    actionLabel: 'Shot paylaş',
    actionTab: 'Create',
  },
  dyno: {
    icon: 'speedometer-outline',
    title: 'Dyno shot yok',
    subtitle: 'Telemetri / WHP / 0-100 açık shot’lar burada görünür.',
    actionLabel: 'Shot paylaş',
    actionTab: 'Create',
  },
};

function ShotSlide({
  shot,
  height,
  active,
  nearActive,
  highlightDyno,
  onLike,
  onDoubleLike,
  onBookmark,
  onComment,
  onMore,
  onOpenProfile,
}: {
  shot: FeedShot;
  height: number;
  active: boolean;
  nearActive: boolean;
  highlightDyno?: boolean;
  onLike: () => void;
  onDoubleLike: () => void;
  onBookmark: () => void;
  onComment: () => void;
  onMore: () => void;
  onOpenProfile: () => void;
}) {
  const [heartBurst, setHeartBurst] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleTapRef = useRef<TapGestureHandlerType>(null);
  const video = isVideoUrl(shot.video_url);

  useEffect(() => {
    if (active) {
      setPaused(false);
      setMuted(false);
    }
  }, [active, shot.id]);

  const cover =
    shot.thumbnail_url ||
    (!video ? shot.video_url : null);

  const showHud =
    highlightDyno ||
    shot.speed_max != null ||
    shot.boost_bar != null ||
    shot.rpm_max != null ||
    shot.dyno_whp != null ||
    shot.zero_to_hundred != null;

  function showHeart() {
    setHeartBurst(true);
    if (heartTimer.current) clearTimeout(heartTimer.current);
    heartTimer.current = setTimeout(() => setHeartBurst(false), 800);
  }

  function onDoubleTap(
    e: HandlerStateChangeEvent<TapGestureHandlerEventPayload>,
  ) {
    if (e.nativeEvent.state !== State.ACTIVE) return;
    showHeart();
    onDoubleLike();
  }

  function onSingleTap(e: HandlerStateChangeEvent<TapGestureHandlerEventPayload>) {
    if (e.nativeEvent.state !== State.ACTIVE) return;
    if (!video || !active) return;
    setPaused((p) => !p);
  }

  return (
    <View style={{ height, width: '100%', backgroundColor: colors.black, overflow: 'hidden' }}>
      <TapGestureHandler
        ref={doubleTapRef}
        numberOfTaps={2}
        maxDelayMs={320}
        onHandlerStateChange={onDoubleTap}
      >
        <TapGestureHandler
          numberOfTaps={1}
          waitFor={doubleTapRef}
          onHandlerStateChange={onSingleTap}
        >
          <View style={styles.slideFill}>
            {cover ? (
              <Image
                source={{ uri: cover }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]} />
            )}

            {video && nearActive ? (
              <ShotVideoLayer
                uri={shot.video_url}
                active={active}
                paused={paused}
                muted={!active || muted}
              />
            ) : null}

            <LinearGradient
              colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.85)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {heartBurst ? (
              <View style={styles.heartBurst} pointerEvents="none">
                <Ionicons name="heart" size={96} color={colors.accent} />
              </View>
            ) : null}

            {video && active && paused ? (
              <View style={styles.pauseOverlay} pointerEvents="none">
                <View style={styles.pauseCircle}>
                  <Ionicons name="play" size={34} color={colors.white} />
                </View>
              </View>
            ) : null}

            {showHud ? (
              <View style={styles.telemetry} pointerEvents="none">
                {shot.dyno_whp != null ? (
                  <Text style={styles.speed}>{shot.dyno_whp} WHP</Text>
                ) : shot.speed_max != null ? (
                  <Text style={styles.speed}>{shot.speed_max} KM/H</Text>
                ) : shot.zero_to_hundred != null ? (
                  <Text style={styles.speed}>{shot.zero_to_hundred}s</Text>
                ) : null}
                <View style={styles.gaugeRow}>
                  {shot.dyno_whp != null && shot.speed_max != null ? (
                    <View style={styles.gaugePill}>
                      <Text style={styles.gaugeText}>{shot.speed_max} KM/H</Text>
                    </View>
                  ) : null}
                  {shot.zero_to_hundred != null && shot.dyno_whp != null ? (
                    <View style={styles.gaugePill}>
                      <Text style={styles.gaugeText}>0-100 {shot.zero_to_hundred}s</Text>
                    </View>
                  ) : null}
                  {shot.boost_bar != null ? (
                    <View style={styles.gaugePill}>
                      <Text style={styles.gaugeText}>● BOOST {shot.boost_bar} BAR</Text>
                    </View>
                  ) : null}
                  {shot.rpm_max != null ? (
                    <View style={styles.gaugePill}>
                      <Text style={styles.gaugeText}>
                        {shot.rpm_max.toLocaleString('tr-TR')} RPM
                      </Text>
                    </View>
                  ) : null}
                  {highlightDyno && isDynoShot(shot) ? (
                    <View style={[styles.gaugePill, styles.dynoPill]}>
                      <Text style={styles.gaugeText}>DYNO</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </TapGestureHandler>
      </TapGestureHandler>

      {/* Mute / like vs. kontroller — tap-pause gesture dışında */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.rightRail}>
          <Pressable onPress={onOpenProfile} hitSlop={6}>
            {shot.creator?.avatar_url ? (
              <Image
                source={{ uri: shot.creator.avatar_url }}
                style={styles.creatorAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.creatorAvatar, styles.avatarFallback]}>
                <Ionicons name="person" size={22} color={colors.white} />
              </View>
            )}
          </Pressable>
          <Pressable style={styles.sideItem} onPress={onLike}>
            <Ionicons
              name={shot.liked_by_me ? 'heart' : 'heart-outline'}
              size={28}
              color={shot.liked_by_me ? colors.accent : colors.white}
            />
            <Text style={styles.sideLabel}>{formatCount(shot.like_count)}</Text>
          </Pressable>
          <Pressable style={styles.sideItem} onPress={onComment}>
            <Ionicons name="chatbubble-ellipses" size={28} color={colors.white} />
            <Text style={styles.sideLabel}>{formatCount(shot.comment_count)}</Text>
          </Pressable>
          <Pressable style={styles.sideItem} onPress={onBookmark}>
            <Ionicons
              name={shot.bookmarked_by_me ? 'bookmark' : 'bookmark-outline'}
              size={28}
              color={colors.white}
            />
            <Text style={styles.sideLabel}>{formatCount(shot.bookmark_count)}</Text>
          </Pressable>
          <Pressable
            style={styles.sideItem}
            onPress={() =>
              void Share.share({
                message: shot.caption || 'CaRPM Shot',
                url: shot.video_url,
              })
            }
          >
            <Ionicons name="arrow-redo" size={28} color={colors.white} />
            <Text style={styles.sideLabel}>{formatCount(shot.share_count)}</Text>
          </Pressable>
          {video && active ? (
            <Pressable
              style={styles.sideItem}
              onPress={() => setMuted((m) => !m)}
              hitSlop={8}
            >
              <Ionicons
                name={muted ? 'volume-mute' : 'volume-high'}
                size={26}
                color={colors.white}
              />
            </Pressable>
          ) : null}
          <Pressable onPress={onMore}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.bottomInfo} pointerEvents="box-none">
          <View style={styles.captionBox}>
            <View style={styles.userRow}>
              <Pressable onPress={onOpenProfile} hitSlop={8}>
                <Text style={styles.username}>@{shot.creator?.username || 'pilot'}</Text>
              </Pressable>
              {shot.club ? (
                <View style={styles.clubPill}>
                  <Text style={styles.clubPillText}>{shot.club.name.toUpperCase()}</Text>
                </View>
              ) : null}
            </View>
            {shot.caption ? (
              <Text style={styles.caption} numberOfLines={3}>
                {shot.caption}
              </Text>
            ) : null}
          </View>
          {shot.vehicle ? (
            <View style={styles.vehicleCard}>
              <Ionicons name="car-sport" size={20} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {shot.vehicle.make} {shot.vehicle.model}
                </Text>
                <Text style={styles.vehicleStats}>
                  {shot.dyno_whp
                    ? `${shot.dyno_whp} WHP`
                    : shot.vehicle.hp
                      ? `${shot.vehicle.hp} HP`
                      : '—'}
                  {shot.zero_to_hundred != null
                    ? ` · 0-100 ${shot.zero_to_hundred}s`
                    : ''}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ShotsScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const listRef = useRef<FlatList<FeedShot>>(null);
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [shots, setShots] = useState<FeedShot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const offsetRef = useRef(0);
  const fetchingMoreRef = useRef(false);

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setPageHeight(h);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageHeight <= 0) return;
      const index = Math.round(e.nativeEvent.contentOffset.y / pageHeight);
      setActiveIndex(index);
    },
    [pageHeight],
  );

  const prefetchAround = useCallback((list: FeedShot[], index: number) => {
    for (const i of [index, index + 1, index + 2]) {
      const s = list[i];
      if (!s) continue;
      const url =
        s.thumbnail_url ||
        (!isVideoUrl(s.video_url) ? s.video_url : null) ||
        s.creator?.avatar_url;
      if (url) void Image.prefetch(url);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      offsetRef.current = 0;
      const page = await fetchShotsFeed(user?.id, tab, {
        limit: FEED_PAGE,
        offset: 0,
      });
      setShots(page.items);
      setHasMore(page.hasMore);
      offsetRef.current = page.nextOffset;
      setActiveIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      prefetchAround(page.items, 0);
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, tab, prefetchAround]);

  const loadMore = useCallback(async () => {
    if (!hasMore || fetchingMoreRef.current || loading || refreshing) return;
    fetchingMoreRef.current = true;
    try {
      const page = await fetchShotsFeed(user?.id, tab, {
        limit: FEED_PAGE,
        offset: offsetRef.current,
      });
      if (page.items.length === 0) {
        setHasMore(false);
        return;
      }
      setShots((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const next = page.items.filter((s) => !seen.has(s.id));
        return next.length ? [...prev, ...next] : prev;
      });
      setHasMore(page.hasMore);
      offsetRef.current = page.nextOffset;
    } catch {
      // sessiz — kullanıcı kaydırmaya devam eder
    } finally {
      fetchingMoreRef.current = false;
    }
  }, [hasMore, loading, refreshing, user?.id, tab]);

  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    void load();
  }, [load]);

  useEffect(() => {
    prefetchAround(shots, activeIndex);
    if (shots.length > 0 && activeIndex >= shots.length - 3) {
      void loadMore();
    }
  }, [activeIndex, shots, prefetchAround, loadMore]);

  function onSelectTab(next: FeedTab) {
    if (next === tab) return;
    setTab(next);
  }

  async function onLike(shot: FeedShot) {
    if (!user) return;
    const liked = !!shot.liked_by_me;
    setShots((prev) =>
      prev.map((s) =>
        s.id === shot.id
          ? {
              ...s,
              liked_by_me: !liked,
              like_count: Math.max(0, s.like_count + (liked ? -1 : 1)),
            }
          : s,
      ),
    );
    try {
      await toggleShotLike(shot.id, user.id, liked);
    } catch (e) {
      void load();
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  /** Çift tık: sadece beğen (zaten beğenildiyse geri alma) */
  async function onDoubleLike(shot: FeedShot) {
    if (!user) return;
    if (shot.liked_by_me) return;
    setShots((prev) =>
      prev.map((s) =>
        s.id === shot.id
          ? {
              ...s,
              liked_by_me: true,
              like_count: (s.like_count ?? 0) + 1,
            }
          : s,
      ),
    );
    try {
      await toggleShotLike(shot.id, user.id, false);
    } catch (e) {
      void load();
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  async function onBookmark(shot: FeedShot) {
    if (!user) return;
    const bookmarked = !!shot.bookmarked_by_me;
    setShots((prev) =>
      prev.map((s) =>
        s.id === shot.id
          ? {
              ...s,
              bookmarked_by_me: !bookmarked,
              bookmark_count: Math.max(0, s.bookmark_count + (bookmarked ? -1 : 1)),
            }
          : s,
      ),
    );
    try {
      await toggleShotBookmark(shot.id, user.id, bookmarked);
    } catch (e) {
      void load();
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  async function onToggleFollow(shot: FeedShot) {
    if (!user || user.id === shot.creator_id) return;
    try {
      const following = await isFollowing(user.id, shot.creator_id);
      await toggleFollow(user.id, shot.creator_id, following);
      sweetAlert(
        following ? 'Takipten çıkıldı' : 'Takip edildi',
        `@${shot.creator?.username || 'pilot'}`,
      );
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  function onMore(shot: FeedShot) {
    const isOwner = user?.id === shot.creator_id;
    sweetAlert('Shot', undefined, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Yorumlar',
        onPress: () => navigation.navigate('Comments', { shotId: shot.id }),
      },
      ...(!isOwner && user
        ? [
            {
              text: 'Takip et / bırak',
              onPress: () => void onToggleFollow(shot),
            },
          ]
        : []),
      ...(isOwner
        ? [
            {
              text: 'Sil',
              style: 'destructive' as const,
              onPress: async () => {
                if (!user) return;
                try {
                  await deleteShot(shot.id, user.id);
                  void load();
                } catch (e) {
                  sweetAlert('Hata', mapAuthError(e));
                }
              },
            },
          ]
        : []),
    ]);
  }

  const empty = EMPTY_COPY[tab];

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {loading ? (
        <ShotsFeedSkeleton />
      ) : error ? (
        <EmptyState
          icon="warning-outline"
          title="Feed yüklenemedi"
          subtitle={error}
          actionLabel="Tekrar dene"
          onAction={() => void load()}
        />
      ) : shots.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            subtitle={empty.subtitle}
            actionLabel={empty.actionLabel}
            onAction={() => navigation.navigate('Tabs', { screen: empty.actionTab })}
          />
        </View>
      ) : pageHeight > 0 ? (
        <FlatList
          ref={listRef}
          data={shots}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          disableIntervalMomentum
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          removeClippedSubviews
          renderItem={({ item, index }) => (
            <ShotSlide
              shot={item}
              height={pageHeight}
              active={isFocused && index === activeIndex}
              nearActive={Math.abs(index - activeIndex) <= 1}
              highlightDyno={tab === 'dyno'}
              onLike={() => {
                void onLike(item);
              }}
              onDoubleLike={() => {
                void onDoubleLike(item);
              }}
              onBookmark={() => {
                void onBookmark(item);
              }}
              onComment={() => navigation.navigate('Comments', { shotId: item.id })}
              onMore={() => onMore(item)}
              onOpenProfile={() => {
                if (!item.creator_id) return;
                if (user?.id === item.creator_id) {
                  navigation.navigate('Tabs', { screen: 'Profile' });
                  return;
                }
                navigation.navigate('UserGarage', { userId: item.creator_id });
              }}
            />
          )}
          extraData={{ activeIndex, isFocused }}
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
        />
      ) : null}

      <SafeAreaView style={styles.overlayHeader} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/icon.png')} style={styles.brandLogo} />
            <Text style={styles.brand}>CaRPM</Text>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => navigation.navigate('Arena')}
              hitSlop={10}
              style={{ marginRight: 14 }}
            >
              <Ionicons name="flame-outline" size={22} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={10}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.tabs}>
            {(
              [
                ['following', 'Takip'],
                ['foryou', 'Senin İçin'],
                ['dyno', 'Dyno'],
              ] as const
            ).map(([key, label]) => (
              <Pressable key={key} onPress={() => onSelectTab(key)}>
                <Text style={[styles.tabText, tab === key && styles.tabActive]}>{label}</Text>
                {tab === key ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, overflow: 'hidden' },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  slideFill: { flex: 1, width: '100%' },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
  },
  pauseCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    transform: [{ translateX: -38 }, { translateY: -38 }],
  },
  heartBurst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  videoPlaceholder: {
    backgroundColor: '#0a0a0a',
  },
  overlayHeader: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar: { paddingHorizontal: spacing.md, gap: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandLogo: { width: 22, height: 22, borderRadius: 5 },
  brand: { color: colors.white, fontWeight: '800', letterSpacing: 0.5 },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  tabText: { color: 'rgba(255,255,255,0.55)', fontWeight: '700', fontSize: 14 },
  tabActive: { color: colors.white },
  tabUnderline: {
    height: 2,
    backgroundColor: colors.white,
    marginTop: 4,
    borderRadius: 1,
  },
  telemetry: { position: 'absolute', top: 110, left: spacing.lg },
  speed: {
    color: colors.white,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  gaugeRow: { marginTop: 8, gap: 8 },
  gaugePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dynoPill: {
    backgroundColor: 'rgba(225, 6, 0, 0.75)',
  },
  gaugeText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  rightRail: {
    position: 'absolute',
    right: 10,
    bottom: 120,
    alignItems: 'center',
    gap: 18,
  },
  creatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideItem: { alignItems: 'center', gap: 2 },
  sideLabel: { color: colors.white, fontSize: 12, fontWeight: '700' },
  bottomInfo: {
    position: 'absolute',
    left: spacing.lg,
    right: 72,
    bottom: 90,
    gap: 8,
  },
  captionBox: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  username: { color: colors.white, fontWeight: '800', fontSize: 15 },
  clubPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  clubPillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  caption: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  vehicleName: { color: colors.white, fontWeight: '800', fontSize: 12 },
  vehicleStats: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
