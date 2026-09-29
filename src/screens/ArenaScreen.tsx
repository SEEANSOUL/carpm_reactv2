import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeableCard } from '../components/SwipeableCard';
import { EmptyState } from '../components/EmptyState';
import {
  batchSubmitArenaVotes,
  fetchArenaDeck,
  type ArenaVehicle,
  type ArenaVotePayload,
} from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'Arena'>;

const PAGE = 10;
const PREFETCH_AT = 3;
const FLUSH_EVERY = 5;

export function ArenaScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [deck, setDeck] = useState<ArenaVehicle[]>([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const excludeRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<ArenaVotePayload[]>([]);
  const fetchingRef = useRef(false);
  const exhaustedRef = useRef(false);

  const flushVotes = useCallback(async () => {
    const batch = pendingRef.current;
    if (batch.length === 0) return;
    pendingRef.current = [];
    try {
      await batchSubmitArenaVotes(batch);
    } catch {
      // kaybolmasın diye geri koy — bir sonraki flush dener
      pendingRef.current = [...batch, ...pendingRef.current];
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!user || fetchingRef.current || exhaustedRef.current) return;
    fetchingRef.current = true;
    try {
      setError(null);
      const rows = await fetchArenaDeck(PAGE, [...excludeRef.current]);
      if (rows.length === 0) {
        exhaustedRef.current = true;
        setDeck((prev) => {
          if (prev.length === 0) setEmpty(true);
          return prev;
        });
      } else {
        rows.forEach((r) => {
          excludeRef.current.add(r.id);
          if (r.image_url) void Image.prefetch(r.image_url);
        });
        setDeck((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const next = rows.filter((r) => !seen.has(r.id));
          return [...prev, ...next];
        });
        setEmpty(false);
      }
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      fetchingRef.current = false;
      setBootLoading(false);
    }
  }, [user]);

  useEffect(() => {
    excludeRef.current = new Set();
    exhaustedRef.current = false;
    pendingRef.current = [];
    setDeck([]);
    setBootLoading(true);
    void loadMore();
  }, [loadMore]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void flushVotes();
      };
    }, [flushVotes]),
  );

  const onSwipe = useCallback(
    (direction: 'like' | 'pass') => {
      setDeck((prev) => {
        const top = prev[0];
        if (!top) return prev;

        pendingRef.current.push({
          vehicle_id: top.id,
          vote: direction === 'like' ? 1 : -1,
        });

        if (pendingRef.current.length >= FLUSH_EVERY) {
          void flushVotes();
        }

        const next = prev.slice(1);
        if (next.length <= PREFETCH_AT) {
          void loadMore();
        }
        if (next.length === 0 && exhaustedRef.current) {
          setEmpty(true);
        }
        return next;
      });
    },
    [flushVotes, loadMore],
  );

  const top = deck[0];
  const next = deck[1];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brand}>ARENA</Text>
          <Text style={styles.hint}>Sağ: ateş · Sol: sıradaki</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('ArenaLeaderboard')}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons name="trophy-outline" size={22} color={colors.gold} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        {bootLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Deck hazırlanıyor…</Text>
          </View>
        ) : error && deck.length === 0 ? (
          <EmptyState
            icon="warning-outline"
            title="Arena açılamadı"
            subtitle={error}
            actionLabel="Tekrar dene"
            onAction={() => {
              exhaustedRef.current = false;
              setBootLoading(true);
              void loadMore();
            }}
          />
        ) : empty || !top ? (
          <EmptyState
            icon="trophy-outline"
            title="Deck bitti"
            subtitle="Şimdilik oylanacak yeni araç kalmadı. Daha sonra tekrar bak."
            actionLabel="Yenile"
            onAction={() => {
              excludeRef.current = new Set();
              exhaustedRef.current = false;
              setDeck([]);
              setEmpty(false);
              setBootLoading(true);
              void loadMore();
            }}
          />
        ) : (
          <>
            {next ? (
              <SwipeableCard key={`behind-${next.id}`} vehicle={next} behind onSwipe={() => {}} />
            ) : null}
            <SwipeableCard key={top.id} vehicle={top} onSwipe={onSwipe} />
          </>
        )}
      </View>

      {top ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.passBtn]}
            onPress={() => onSwipe('pass')}
          >
            <Ionicons name="close" size={28} color={colors.accent} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.likeBtn]}
            onPress={() => onSwipe('like')}
          >
            <Ionicons name="flame" size={28} color="#22C55E" />
          </Pressable>
        </View>
      ) : (
        <View style={{ height: 88 }} />
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
  stage: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textMuted, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    paddingBottom: spacing.md,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  passBtn: { borderColor: 'rgba(225, 6, 0, 0.45)' },
  likeBtn: { borderColor: 'rgba(34, 197, 94, 0.45)' },
});
