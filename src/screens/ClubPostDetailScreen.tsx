import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  addClubPostReply,
  deleteClubPostReply,
  fetchClubPost,
  fetchClubPostReplies,
  toggleClubPostLike,
} from '../api/carpm';
import { EmptyState } from '../components/EmptyState';
import { ListRowsSkeleton } from '../components/ScreenSkeletons';
import { KeyboardSheet } from '../components/KeyboardAware';
import { sweetAlert } from '../components/SweetAlert';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import type { ClubPost, ClubPostReply } from '../types/models';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'ClubPostDetail'>;

export function ClubPostDetailScreen({ navigation, route }: Props) {
  const { clubId, postId } = route.params;
  const { user } = useAuth();
  const [post, setPost] = useState<ClubPost | null>(null);
  const [replies, setReplies] = useState<ClubPostReply[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        fetchClubPost(postId, user?.id),
        fetchClubPostReplies(postId),
      ]);
      setPost(p);
      setReplies(r);
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onLike() {
    if (!user || !post) return;
    const liked = !!post.liked_by_me;
    setPost({
      ...post,
      liked_by_me: !liked,
      like_count: Math.max(0, post.like_count + (liked ? -1 : 1)),
    });
    try {
      await toggleClubPostLike(post.id, user.id, liked);
    } catch (e) {
      void load();
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  async function onSend() {
    if (!user || !body.trim()) return;
    setSending(true);
    try {
      const reply = await addClubPostReply({
        post_id: postId,
        club_id: clubId,
        author_id: user.id,
        body,
      });
      setReplies((prev) => [...prev, reply]);
      setPost((p) =>
        p ? { ...p, reply_count: (p.reply_count ?? 0) + 1 } : p,
      );
      setBody('');
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setSending(false);
    }
  }

  function onDeleteReply(r: ClubPostReply) {
    if (!user) return;
    sweetAlert('Sil', 'Yanıt silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClubPostReply(r.id);
            setReplies((prev) => prev.filter((x) => x.id !== r.id));
            setPost((p) =>
              p
                ? { ...p, reply_count: Math.max(0, (p.reply_count ?? 1) - 1) }
                : p,
            );
          } catch (e) {
            sweetAlert('Hata', mapAuthError(e));
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gönderi</Text>
        {post && user?.id === post.author_id ? (
          <Pressable
            onPress={() =>
              navigation.navigate('CreateClubPost', {
                clubId,
                postId: post.id,
              })
            }
            hitSlop={12}
          >
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {loading ? (
        <ListRowsSkeleton rows={6} />
      ) : !post ? (
        <EmptyState icon="alert-circle-outline" title="Gönderi bulunamadı" />
      ) : (
        <KeyboardSheet
          footer={
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={body}
                onChangeText={setBody}
                placeholder="Yanıt yaz..."
                placeholderTextColor={colors.textDim}
                multiline
                maxLength={2000}
              />
              <Pressable
                style={[styles.sendBtn, (!body.trim() || sending) && styles.sendDisabled]}
                onPress={() => void onSend()}
                disabled={!body.trim() || sending}
              >
                <Ionicons name="send" size={18} color={colors.black} />
              </Pressable>
            </View>
          }
        >
          <FlatList
            data={replies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
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
            ListHeaderComponent={
              <View style={styles.postCard}>
                <View style={styles.postHead}>
                  <UserAvatar
                    uri={post.author?.avatar_url}
                    name={post.author?.full_name || post.author?.username}
                    size={40}
                  />
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
                </View>
                <Text style={styles.body}>{post.body}</Text>
                {post.image_url ? (
                  <Image source={{ uri: post.image_url }} style={styles.postImage} />
                ) : null}
                <View style={styles.actions}>
                  <Pressable style={styles.action} onPress={() => void onLike()}>
                    <Ionicons
                      name={post.liked_by_me ? 'heart' : 'heart-outline'}
                      size={18}
                      color={post.liked_by_me ? colors.accent : colors.textMuted}
                    />
                    <Text style={styles.actionText}>{post.like_count}</Text>
                  </Pressable>
                  <View style={styles.action}>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.actionText}>{post.reply_count ?? replies.length}</Text>
                  </View>
                </View>
                <Text style={styles.repliesTitle}>Yanıtlar</Text>
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="Henüz yanıt yok"
                subtitle="İlk yanıtı sen yaz."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.replyRow}
                onLongPress={() => {
                  if (user?.id === item.author_id) onDeleteReply(item);
                }}
              >
                <UserAvatar
                  uri={item.author?.avatar_url}
                  name={item.author?.full_name || item.author?.username}
                  size={32}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyAuthor}>
                    @{item.author?.username || 'pilot'}
                    <Text style={styles.replyTime}>
                      {'  '}
                      {new Date(item.created_at).toLocaleString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Text>
                  <Text style={styles.replyBody}>{item.body}</Text>
                </View>
              </Pressable>
            )}
          />
        </KeyboardSheet>
      )}
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
  headerTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  list: { padding: spacing.lg, paddingBottom: 24, gap: 10, flexGrow: 1 },
  postCard: { gap: 10, marginBottom: spacing.md },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  author: { color: colors.text, fontWeight: '800' },
  time: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  actions: { flexDirection: 'row', gap: 18, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: colors.textMuted, fontWeight: '700' },
  repliesTitle: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyAvatar: { width: 32, height: 32, borderRadius: 16 },
  replyAuthor: { color: colors.text, fontWeight: '800', fontSize: 13 },
  replyTime: { color: colors.textDim, fontWeight: '600', fontSize: 11 },
  replyBody: { color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
});
