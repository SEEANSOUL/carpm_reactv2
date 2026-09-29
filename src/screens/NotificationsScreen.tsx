import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../components/EmptyState';
import { ListRowsSkeleton } from '../components/ScreenSkeletons';
import { UserAvatar } from '../components/UserAvatar';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import type { AppNotification } from '../types/models';
import { sweetAlert } from '../components/SweetAlert';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'Notifications'>;

function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'like') return 'heart';
  if (type === 'follow') return 'person-add';
  if (type === 'club_join' || type === 'club_join_approved') return 'people';
  if (type === 'club_join_request') return 'person-add';
  if (type === 'club_join_rejected') return 'close-circle';
  if (type === 'club_reply') return 'chatbubble';
  return 'notifications';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  const d = Math.floor(h / 24);
  return `${d}g`;
}

export function NotificationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setItems(await fetchNotifications(user.id));
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

  async function onOpen(n: AppNotification) {
    if (!user) return;
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id, user.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
        );
      } catch {
        /* ignore */
      }
    }

    const data = n.data ?? {};
    if (n.type === 'like' && typeof data.shot_id === 'string') {
      navigation.navigate('Comments', { shotId: data.shot_id });
      return;
    }
    if (n.type === 'follow') {
      const actorId =
        (typeof data.actor_id === 'string' && data.actor_id) || n.actor_id;
      if (actorId) navigation.navigate('UserGarage', { userId: actorId });
      return;
    }
    if (n.type === 'club_join' && typeof data.club_id === 'string') {
      navigation.navigate('ClubDetail', { clubId: data.club_id });
      return;
    }
    if (
      (n.type === 'club_join_request' ||
        n.type === 'club_join_approved' ||
        n.type === 'club_join_rejected') &&
      typeof data.club_id === 'string'
    ) {
      navigation.navigate('ClubDetail', { clubId: data.club_id });
      return;
    }
    if (
      n.type === 'club_reply' &&
      typeof data.club_id === 'string' &&
      typeof data.post_id === 'string'
    ) {
      navigation.navigate('ClubPostDetail', {
        clubId: data.club_id,
        postId: data.post_id,
      });
    }
  }

  async function onMarkAll() {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.id);
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        <Pressable onPress={() => void onMarkAll()} hitSlop={8}>
          <Text style={styles.markAll}>Okundu</Text>
        </Pressable>
      </View>

      {loading ? (
        <ListRowsSkeleton rows={8} />
      ) : (
        <FlatList
          data={items}
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
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Bildirim yok"
              subtitle="Beğeni, takip ve kulüp katılımı burada görünür."
            />
          }
          renderItem={({ item }) => {
            return (
              <Pressable
                style={[styles.row, !item.is_read && styles.rowUnread]}
                onPress={() => void onOpen(item)}
              >
                <View style={styles.avatarWrap}>
                  <UserAvatar
                    uri={item.actor?.avatar_url}
                    name={item.actor?.full_name || item.actor?.username}
                    size={44}
                  />
                  <View style={styles.typeBadge}>
                    <Ionicons name={iconFor(item.type)} size={12} color={colors.white} />
                  </View>
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.body ? (
                    <Text style={styles.text} numberOfLines={2}>
                      {item.body}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                {!item.is_read ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            );
          }}
        />
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
  headerTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  markAll: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  list: { padding: spacing.lg, paddingBottom: 40, flexGrow: 1, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: {
    borderColor: 'rgba(225,6,0,0.35)',
    backgroundColor: colors.cardSoft,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  typeBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  body: { flex: 1, gap: 2 },
  title: { color: colors.text, fontWeight: '800', fontSize: 14 },
  text: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  time: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
