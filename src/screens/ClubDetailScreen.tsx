import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { CarpmLoader } from '../components/CarpmLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../components/EmptyState';
import { ClubDetailSkeleton } from '../components/ScreenSkeletons';
import {
  deleteClubPost,
  fetchClub,
  fetchClubPosts,
  fetchClubPostTags,
  fetchPendingClubMembers,
  getClubMembershipStatus,
  joinClub,
  leaveClub,
  setClubMemberStatus,
  toggleClubPostLike,
  type ClubMembershipStatus,
  type PendingClubMember,
} from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import type { Club, ClubPost } from '../types/models';
import { formatCount } from '../utils/format';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'ClubDetail'>;

export function ClubDetailScreen({ navigation, route }: Props) {
  const { clubId } = route.params;
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [member, setMember] = useState(false);
  const [membership, setMembership] = useState<ClubMembershipStatus>('none');
  const [pending, setPending] = useState<PendingClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);

  const isOwner = !!user && !!club && club.created_by === user.id;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const c = await fetchClub(clubId);
      setClub(c);
      const status = await getClubMembershipStatus(clubId, user.id);
      setMembership(status);
      const isMember = status === 'approved';
      setMember(isMember);
      if (isMember) {
        const [p, t] = await Promise.all([
          fetchClubPosts(clubId, user.id, activeTag),
          fetchClubPostTags(clubId).catch(() => [] as string[]),
        ]);
        setPosts(p);
        setTags(t);
      } else {
        setPosts([]);
        setTags([]);
      }
      if (c?.created_by === user.id) {
        setPending(await fetchPendingClubMembers(clubId).catch(() => []));
      } else {
        setPending([]);
      }
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, clubId, activeTag]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void load();
    });
    return unsub;
  }, [navigation, load]);

  const banner =
    club?.banner_url ||
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200';

  async function onJoin() {
    if (!user) return;
    setBusyJoin(true);
    try {
      const status = await joinClub(clubId, user.id);
      setMembership(status);
      setMember(status === 'approved');
      if (status === 'pending') {
        sweetAlert('İstek gönderildi', 'Kurucu onaylayınca forum açılacak.');
      }
      void load();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setBusyJoin(false);
    }
  }

  async function onDecide(memberUserId: string, status: 'approved' | 'rejected') {
    try {
      await setClubMemberStatus(clubId, memberUserId, status);
      void load();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  async function onLeave() {
    if (!user) return;
    sweetAlert('Ayrıl', 'Kulüpten ve forumdan ayrılmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Ayrıl',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveClub(clubId, user.id);
            setMember(false);
            setPosts([]);
            void load();
          } catch (e) {
            sweetAlert('Hata', mapAuthError(e));
          }
        },
      },
    ]);
  }

  async function onLike(post: ClubPost) {
    if (!user) return;
    const liked = !!post.liked_by_me;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !liked,
              like_count: Math.max(0, p.like_count + (liked ? -1 : 1)),
            }
          : p,
      ),
    );
    try {
      await toggleClubPostLike(post.id, user.id, liked);
    } catch (e) {
      void load();
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  function onPostMore(post: ClubPost) {
    const isAuthor = user?.id === post.author_id;
    sweetAlert('Gönderi', undefined, [
      { text: 'İptal', style: 'cancel' },
      ...(isAuthor
        ? [
            {
              text: 'Düzenle',
              onPress: () =>
                navigation.navigate('CreateClubPost', {
                  clubId,
                  postId: post.id,
                }),
            },
            {
              text: 'Sil',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await deleteClubPost(post.id);
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

  const tagChips = useMemo(() => {
    const list = tags.slice(0, 12);
    return list;
  }, [tags]);

  if (loading && !club) {
    return (
      <SafeAreaView style={styles.safe}>
        <ClubDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="alert-circle-outline" title="Kulüp bulunamadı" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {club.name}
        </Text>
        {member ? (
          <Pressable
            onPress={() => navigation.navigate('CreateClubPost', { clubId })}
            hitSlop={12}
          >
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        <ImageBackground
          source={{ uri: banner }}
          style={styles.hero}
          imageStyle={{ borderRadius: radii.xl }}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.88)']}
            style={styles.heroGrad}
          >
            <View style={styles.heroTop}>
              {club.logo_url ? (
                <Image source={{ uri: club.logo_url }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoFallback]}>
                  <Ionicons name="people" size={22} color={colors.white} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.clubName}>{club.name}</Text>
                <Text style={styles.meta}>
                  {formatCount(club.member_count)} üye
                  {club.location ? ` · ${club.location}` : ''}
                </Text>
              </View>
            </View>
            {club.description ? (
              <Text style={styles.desc} numberOfLines={3}>
                {club.description}
              </Text>
            ) : null}
            <View style={styles.heroActions}>
              {member ? (
                <>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => navigation.navigate('CreateClubPost', { clubId })}
                  >
                    <Ionicons name="add" size={16} color={colors.black} />
                    <Text style={styles.primaryBtnText}>Forum’a yaz</Text>
                  </Pressable>
                  {isOwner ? (
                    <Pressable
                      style={styles.ghostBtn}
                      onPress={() => navigation.navigate('CreateEvent', { clubId })}
                    >
                      <Text style={styles.ghostBtnText}>Etkinlik</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.ghostBtn} onPress={onLeave}>
                    <Text style={styles.ghostBtnText}>Ayrıl</Text>
                  </Pressable>
                </>
              ) : membership === 'pending' ? (
                <View style={styles.pendingBadge}>
                  <Ionicons name="time-outline" size={16} color={colors.gold} />
                  <Text style={styles.pendingText}>Onay bekleniyor</Text>
                </View>
              ) : (
                <Pressable style={styles.primaryBtn} onPress={onJoin} disabled={busyJoin}>
                  {busyJoin ? (
                    <CarpmLoader size="sm" tone="dark" />
                  ) : (
                    <>
                      <Ionicons name="lock-open-outline" size={16} color={colors.black} />
                      <Text style={styles.primaryBtnText}>
                        {membership === 'rejected' ? 'Tekrar istek gönder' : 'Katılım isteği gönder'}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </LinearGradient>
        </ImageBackground>

        {isOwner && pending.length > 0 ? (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingTitle}>Katılım istekleri ({pending.length})</Text>
            {pending.map((req) => (
              <View key={req.id} style={styles.pendingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingName}>
                    @{req.profile?.username || 'pilot'}
                  </Text>
                  {req.profile?.full_name ? (
                    <Text style={styles.pendingSub}>{req.profile.full_name}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.approveBtn}
                  onPress={() => void onDecide(req.user_id, 'approved')}
                >
                  <Text style={styles.approveText}>Kabul</Text>
                </Pressable>
                <Pressable
                  style={styles.rejectBtn}
                  onPress={() => void onDecide(req.user_id, 'rejected')}
                >
                  <Text style={styles.rejectText}>Red</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
          <Text style={styles.sectionTitle}>Kulüp Forumu</Text>
          <Text style={styles.sectionHint}>Sadece üyeler</Text>
        </View>

        {!member ? (
          <EmptyState
            icon="lock-closed-outline"
            title={membership === 'pending' ? 'Onay bekleniyor' : 'Forum kilitli'}
            subtitle={
              membership === 'pending'
                ? 'Kurucu isteğini onaylayınca forum açılır.'
                : 'Katılım isteği gönder; kurucu onaylayınca yazı ve #etiketler açılır.'
            }
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagRow}
            >
              <Pressable
                onPress={() => setActiveTag(null)}
                style={[styles.tagChip, !activeTag && styles.tagChipOn]}
              >
                <Text style={[styles.tagText, !activeTag && styles.tagTextOn]}>Tümü</Text>
              </Pressable>
              {tagChips.map((tag) => {
                const on = activeTag === tag;
                return (
                  <Pressable
                    key={tag}
                    onPress={() => setActiveTag(on ? null : tag)}
                    style={[styles.tagChip, on && styles.tagChipOn]}
                  >
                    <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {posts.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="Henüz gönderi yok"
                subtitle="İlk yazıyı sen at. #dyno #konvoy gibi etiket kullan."
                actionLabel="Yazı paylaş"
                onAction={() => navigation.navigate('CreateClubPost', { clubId })}
              />
            ) : (
              posts.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.postCard}
                  onPress={() =>
                    navigation.navigate('ClubPostDetail', {
                      clubId,
                      postId: post.id,
                    })
                  }
                >
                  <View style={styles.postHead}>
                    {post.author?.avatar_url ? (
                      <Image
                        source={{ uri: post.author.avatar_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Ionicons name="person" size={16} color={colors.white} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.author}>
                        @{post.author?.username || 'pilot'}
                      </Text>
                      <Text style={styles.time}>
                        {new Date(post.created_at).toLocaleString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onPostMore(post);
                      }}
                      hitSlop={10}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textDim} />
                    </Pressable>
                  </View>

                  <Text style={styles.body} numberOfLines={6}>
                    {post.body}
                  </Text>

                  {post.hashtags?.length ? (
                    <View style={styles.postTags}>
                      {post.hashtags.map((t) => (
                        <Pressable
                          key={t}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setActiveTag(t);
                          }}
                        >
                          <Text style={styles.postTag}>{t}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {post.image_url ? (
                    <Image source={{ uri: post.image_url }} style={styles.postImage} />
                  ) : null}

                  <View style={styles.likeRow}>
                    <Pressable
                      style={styles.statHit}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void onLike(post);
                      }}
                    >
                      <Ionicons
                        name={post.liked_by_me ? 'heart' : 'heart-outline'}
                        size={18}
                        color={post.liked_by_me ? colors.accent : colors.textMuted}
                      />
                      <Text style={styles.likeText}>{formatCount(post.like_count)}</Text>
                    </Pressable>
                    <View style={styles.statHit}>
                      <Ionicons name="chatbubble-outline" size={17} color={colors.textMuted} />
                      <Text style={styles.likeText}>
                        {formatCount(post.reply_count ?? 0)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}
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
    paddingBottom: spacing.sm,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  hero: { height: 210, borderRadius: radii.xl, overflow: 'hidden' },
  heroGrad: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  logoFallback: {
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubName: { color: colors.white, fontWeight: '900', fontSize: 20 },
  meta: { color: 'rgba(255,255,255,0.7)', marginTop: 2, fontSize: 12 },
  desc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  primaryBtnText: { color: colors.black, fontWeight: '800', fontSize: 13 },
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ghostBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 },
  sectionHint: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  tagRow: { gap: 8, paddingVertical: 4 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  tagChipOn: { backgroundColor: colors.white, borderColor: colors.white },
  tagText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  tagTextOn: { color: colors.black },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 10,
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  author: { color: colors.text, fontWeight: '800', fontSize: 13 },
  time: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  postTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  postTag: { color: colors.blue, fontWeight: '700', fontSize: 13 },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
  },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
  statHit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  pendingText: { color: colors.gold, fontWeight: '800' },
  pendingBox: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
  },
  pendingTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingName: { color: colors.text, fontWeight: '700' },
  pendingSub: { color: colors.textMuted, fontSize: 12 },
  approveBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  approveText: { color: colors.black, fontWeight: '800', fontSize: 12 },
  rejectBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  rejectText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
});
