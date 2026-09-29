import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { sweetAlert } from '../components/SweetAlert';
import { EmptyState } from '../components/EmptyState';
import { deleteDriveLog, fetchMyDriveLogs, fetchMyVehicles } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import {
  formatDistanceKm,
  formatDriveDate,
  formatDurationCompact,
  formatLiters,
  formatSpeedKmh,
  formatTry,
} from '../lib/driveFormat';
import type { DriveLog } from '../types/models';
import { colors, radii, spacing } from '../theme/colors';

export function DriveHistoryScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const [logs, setLogs] = useState<DriveLog[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLogs([]);
      setLoading(false);
      return;
    }
    try {
      const [nextLogs, vehicles] = await Promise.all([
        fetchMyDriveLogs(user.id),
        fetchMyVehicles(user.id).catch(() => []),
      ]);
      const byId: Record<string, string> = {};
      for (const vehicle of vehicles) {
        if (vehicle.image_url) byId[vehicle.id] = vehicle.image_url;
      }
      setPhotos(byId);
      setLogs(nextLogs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sürüşler yüklenemedi.';
      sweetAlert('Sürüş geçmişi', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const summary = logs.reduce(
    (acc, log) => ({
      distance: acc.distance + log.total_distance_km,
      seconds: acc.seconds + log.duration_seconds,
      maxSpeed: Math.max(acc.maxSpeed, log.max_speed_kmh),
      count: acc.count + 1,
    }),
    { distance: 0, seconds: 0, maxSpeed: 0, count: 0 },
  );

  function confirmDelete(log: DriveLog) {
    if (!user) return;
    sweetAlert('Sürüşü sil', 'Bu kayıt kalıcı olarak silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDriveLog(log.id, user.id);
            setLogs((current) => current.filter((item) => item.id !== log.id));
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Silinemedi.';
            sweetAlert('Hata', message);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Sürüş Geçmişi</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.drive}
          />
        }
      >
        <View style={styles.grid}>
          <SummaryCard icon="navigate" color={colors.blue} label="Toplam Mesafe" value={`${formatDistanceKm(summary.distance)} km`} />
          <SummaryCard icon="time" color={colors.drive} label="Toplam Süre" value={formatDurationCompact(summary.seconds)} />
          <SummaryCard icon="speedometer" color={colors.accent} label="En Yüksek Hız" value={`${formatSpeedKmh(summary.maxSpeed)} km/h`} />
          <SummaryCard icon="layers" color={colors.success} label="Toplam Sürüş" value={String(summary.count)} />
        </View>
        <Text style={styles.section}>Son Sürüşler</Text>
        {loading ? (
          <EmptyState loading title="Yükleniyor" />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="navigate-outline"
            title="Henüz sürüş yok"
            subtitle="İlk sürüşünü tamamlayıp kaydet."
            actionLabel="Sürüşe başla"
            onAction={() => navigation.navigate('Tabs', { screen: 'Drive' })}
          />
        ) : (
          logs.map((log) => (
            <Pressable
              key={log.id}
              style={styles.row}
              onPress={() => navigation.navigate('DriveLogDetail', { log })}
              onLongPress={() => confirmDelete(log)}
            >
              <HistoryPhoto uri={log.vehicle_image_url || (log.vehicle_id ? photos[log.vehicle_id] : null)} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{formatDriveDate(log.ended_at)}</Text>
                <Text style={styles.rowMeta}>
                  {formatDistanceKm(log.total_distance_km)} km · {formatDurationCompact(log.duration_seconds)} · ort{' '}
                  {formatSpeedKmh(log.average_speed_kmh)} km/h
                  {log.fuel_liters != null ? ` · ${formatLiters(log.fuel_liters)} L` : ''}
                  {log.fuel_cost_try != null ? ` · ${formatTry(log.fuel_cost_try)} TL` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HistoryPhoto({ uri }: { uri?: string | null }) {
  if (!uri) {
    return (
      <View style={styles.rowIcon}>
        <Ionicons name="car-sport" size={18} color={colors.drive} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.rowPhoto} contentFit="cover" />;
}

function SummaryCard({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  headerSpacer: { width: 22 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  cardValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  section: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPhoto: { width: 52, height: 52, borderRadius: 12 },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
});
