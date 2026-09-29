import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../components/EmptyState';
import { fetchArenaLeaderboard, type ArenaVehicle } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'ArenaLeaderboard'>;

const FALLBACK =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800';

function rankTone(rank: number) {
  if (rank === 1) return colors.gold;
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return colors.textDim;
}

function LeaderRow({
  item,
  rank,
  isMine,
  onPress,
}: {
  item: ArenaVehicle;
  rank: number;
  isMine: boolean;
  onPress: () => void;
}) {
  const score = item.arena_score ?? 0;
  const likes = item.arena_likes ?? 0;
  const passes = item.arena_passes ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, isMine && styles.rowMine, rank <= 3 && styles.rowPodium]}
    >
      <Text style={[styles.rank, { color: rankTone(rank) }]}>#{rank}</Text>
      <Image
        source={{ uri: item.image_url || FALLBACK }}
        style={styles.thumb}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {item.make} {item.model}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.owner?.username ? `@${item.owner.username}` : 'Pilot'}
          {item.hp != null ? ` · ${item.hp} HP` : ''}
        </Text>
        <View style={styles.statLine}>
          <Text style={styles.statFire}>🔥 {likes}</Text>
          <Text style={styles.statPass}>🛑 {passes}</Text>
        </View>
      </View>
      <View style={styles.scoreBox}>
        <Text style={[styles.score, rank <= 3 && { color: rankTone(rank) }]}>{score}</Text>
        <Text style={styles.scoreLab}>SKOR</Text>
      </View>
    </Pressable>
  );
}

export function ArenaLeaderboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ArenaVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await fetchArenaLeaderboard(50));
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brand}>SIRALAMA</Text>
          <Text style={styles.hint}>Arena skoru · ateş − sıradaki</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Arena')}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons name="flame" size={22} color={colors.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <EmptyState
          icon="warning-outline"
          title="Sıralama alınamadı"
          subtitle={error}
          actionLabel="Tekrar dene"
          onAction={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="Henüz sıralama yok"
          subtitle="İlk oylar gelince liderlik tablosu burada dolacak. Arena’da kaydırmaya başla."
          actionLabel="Arenaya git"
          onAction={() => navigation.navigate('Arena')}
        />
      ) : (
        <FlatList
          data={rows}
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
          renderItem={({ item, index }) => (
            <LeaderRow
              item={item}
              rank={index + 1}
              isMine={!!user && item.owner_id === user.id}
              onPress={() => navigation.navigate('UserGarage', { userId: item.owner_id })}
            />
          )}
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  brand: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
  },
  hint: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowMine: {
    borderColor: 'rgba(225, 6, 0, 0.55)',
    backgroundColor: 'rgba(225, 6, 0, 0.08)',
  },
  rowPodium: {
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  rank: {
    width: 36,
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
  },
  thumb: {
    width: 64,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.cardSoft,
  },
  meta: { flex: 1, gap: 2 },
  title: { color: colors.white, fontWeight: '800', fontSize: 15 },
  sub: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  statLine: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statFire: { color: '#4ADE80', fontSize: 11, fontWeight: '700' },
  statPass: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  scoreBox: { alignItems: 'center', minWidth: 44 },
  score: { color: colors.white, fontWeight: '900', fontSize: 18 },
  scoreLab: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
