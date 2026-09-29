import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sweetAlert } from '../components/SweetAlert';
import { DriveCarPicker } from '../components/DriveCarPicker';
import { DriveMap } from '../components/DriveMap';
import { DriveStoryCard, type DriveStoryCardHandle } from '../components/DriveStoryCard';
import { saveDriveLog } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { driveTracker, type DriveSessionResult } from '../lib/driveTracker';
import {
  formatDistanceKm,
  formatDuration,
  formatDurationStory,
  formatSpeedKmh,
  fuelCostTry,
  fuelLiters,
} from '../lib/driveFormat';
import { publishDriveStoryImage } from '../lib/shareDriveStory';
import { colors, radii } from '../theme/colors';

const ISTANBUL = { latitude: 41.0082, longitude: 28.9784 };

function useDriveSnapshot() {
  return useSyncExternalStore(
    driveTracker.subscribe,
    driveTracker.getSnapshot,
    driveTracker.getSnapshot,
  );
}

export function LiveDriveScreen() {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const snapshot = useDriveSnapshot();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const storyCard = useRef<DriveStoryCardHandle>(null);
  const [story, setStory] = useState<DriveSessionResult | null>(null);
  const [armed, setArmed] = useState(() => {
    const snap = driveTracker.getSnapshot();
    return snap.status !== 'idle' || snap.hasPendingSave || driveTracker.getVehicle() != null;
  });
  const [initial, setInitial] = useState(ISTANBUL);
  const [userPoint, setUserPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (snapshot.status !== 'idle') return;
    let alive = true;
    let watch: Location.LocationSubscription | null = null;
    void Location.requestForegroundPermissionsAsync()
      .then(async (permission) => {
        if (!alive || permission.status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive) return;
        const point = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setUserPoint(point);
        setInitial(point);
        const next = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 8 },
          (position) => {
            if (!alive) return;
            setUserPoint({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
        );
        if (!alive) {
          next.remove();
          return;
        }
        watch = next;
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      watch?.remove();
    };
  }, [snapshot.status]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (driveTracker.getSnapshot().status === 'idle') return;
      event.preventDefault();
      sweetAlert('Sürüşü iptal et?', 'Kaydetmeden çıkarsan bu sürüşün verileri silinir.', [
        { text: 'Kal', style: 'cancel' },
        {
          text: 'Çık',
          style: 'destructive',
          onPress: () => {
            driveTracker.reset();
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });
  }, [navigation]);

  async function onStart() {
    if (!driveTracker.getVehicle()) {
      setArmed(false);
      return;
    }
    try {
      await driveTracker.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sürüş başlatılamadı.';
      sweetAlert('Konum', message);
    }
  }

  async function onPauseResume() {
    try {
      if (snapshot.status === 'tracking') await driveTracker.pause();
      else if (snapshot.status === 'paused') await driveTracker.resume();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sürüş güncellenemedi.';
      sweetAlert('Sürüş', message);
    }
  }

  async function persist(session: DriveSessionResult) {
    if (!user) {
      if (mounted.current) setSaveError('Giriş gerekli. Kart açık kalsın, girişten sonra tekrar kaydet.');
      return;
    }
    if (mounted.current) {
      setSaving(true);
      setSaveError(null);
    }
    try {
      await saveDriveLog(user.id, session);
      driveTracker.clearPending();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sürüş kaydedilemedi.';
      if (message.includes('kısa')) driveTracker.clearPending();
      if (mounted.current) setSaveError(message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  async function shareStory() {
    if (!user || !story?.vehicle?.imageUrl || shared || !storyCard.current) return;
    setSharing(true);
    setShareError(null);
    try {
      const imageUri = await storyCard.current.captureImage();
      const caption = [
        story.vehicle.label,
        `${formatDistanceKm(story.totalDistanceKm)} km`,
        formatDurationStory(story.durationSeconds),
        `maks ${formatSpeedKmh(story.maxSpeedKmh)} km/h`,
      ].join(' · ');
      await publishDriveStoryImage({
        userId: user.id,
        imageUri,
        caption,
        vehicleId: story.vehicle.id,
      });
      setShared(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Paylaşılamadı.';
      if (mounted.current) setShareError(message);
    } finally {
      if (mounted.current) setSharing(false);
    }
  }

  function onFinish() {
    const session = driveTracker.finish();
    if (!session) {
      sweetAlert('Sürüş', 'Kaydedilecek sürüş bulunamadı.');
      return;
    }
    setStory(session);
    if (session.route.length < 2 || session.totalDistanceKm < 0.05) {
      driveTracker.clearPending();
      setSaveError('Rota oluşmadı. Biraz yol al, sonra tekrar bitir.');
      return;
    }
    setSaveError(null);
    void persist(session);
  }

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: story ? { display: 'none' } : undefined,
    });
  }, [navigation, story]);

  const here = snapshot.lastPoint
    ? { latitude: snapshot.lastPoint.latitude, longitude: snapshot.lastPoint.longitude }
    : userPoint;
  const follow = here;
  const active = snapshot.status !== 'idle';
  const pilotName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'Pilot';
  const car = driveTracker.getVehicle();
  const dock = 78 + Math.max(insets.bottom, 10);

  if (!story && !armed && user && snapshot.status === 'idle' && !snapshot.hasPendingSave) {
    return (
      <DriveCarPicker userId={user.id} onReady={() => setArmed(true)} />
    );
  }

  if (story) {
    return (
      <View style={styles.screen}>
        <DriveStoryCard
          ref={storyCard}
          name={pilotName}
          avatarUrl={profile?.avatar_url}
          distanceKm={story.totalDistanceKm}
          durationSeconds={story.durationSeconds}
          maxSpeedKmh={story.maxSpeedKmh}
          route={story.route}
          vehicleLabel={story.vehicle?.label}
          vehicleImageUrl={story.vehicle?.imageUrl}
          fuelLiters={
            story.vehicle ? fuelLiters(story.totalDistanceKm, story.vehicle.lPer100km) : null
          }
          fuelCostTry={
            story.vehicle
              ? fuelCostTry(
                  fuelLiters(story.totalDistanceKm, story.vehicle.lPer100km),
                  story.vehicle.priceTry,
                )
              : null
          }
          fuelLPer100={story.vehicle?.lPer100km}
          notice={shareError ?? saveError}
          noticeBusy={saving || sharing}
          onNotice={() => {
            if (shareError) {
              void shareStory();
              return;
            }
            if (saveError?.includes('Rota oluşmadı')) {
              driveTracker.clearVehicle();
              setStory(null);
              setArmed(false);
              setSaveError(null);
              setShareError(null);
              setShared(false);
              return;
            }
            void persist(story);
          }}
          onShare={() => void shareStory()}
          sharing={sharing}
          shared={shared}
          onClose={() => {
            driveTracker.clearVehicle();
            setStory(null);
            setArmed(false);
            setShared(false);
            setSaveError(null);
            setShareError(null);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DriveMap
        points={snapshot.routePoints}
        follow={follow}
        initial={here ?? initial}
        markers={
          here
            ? [
                {
                  id: snapshot.status === 'idle' ? 'me' : 'current',
                  latitude: here.latitude,
                  longitude: here.longitude,
                  title: 'Konum',
                },
              ]
            : []
        }
      />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.circle} />
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {car ? car.label.toUpperCase() : 'SÜRÜŞ TAKİBİ'}
          </Text>
        </View>
        <Pressable
          style={styles.circle}
          onPress={() => {
            if (driveTracker.getSnapshot().status !== 'idle') {
              sweetAlert(
                'Sürüş sürüyor',
                'Geçmiş, sürüş bitmeden açılmaz. Hareket halinde Supabase çağrısı yok.',
              );
              return;
            }
            navigation.navigate('DriveHistory');
          }}
        >
          <Ionicons name="time-outline" size={22} color={colors.white} />
        </Pressable>
      </View>

      <View style={[styles.dashboard, { marginBottom: dock }]}>
        <View style={styles.tileRow}>
          <TelemetryTile
            label="HIZ"
            value={formatSpeedKmh(snapshot.currentSpeedKmh)}
            unit="km/h"
            highlight
          />
          <TelemetryTile
            label="MESAFE"
            value={formatDistanceKm(snapshot.totalDistanceKm)}
            unit="km"
          />
          <TelemetryTile label="SÜRE" value={formatDuration(snapshot.elapsedSeconds)} unit="" />
        </View>

        {snapshot.status === 'idle' && snapshot.hasPendingSave ? (
          <Pressable
            style={[styles.primary, saving && styles.disabled]}
            disabled={saving}
            onPress={() => {
              const session = driveTracker.getPendingSession();
              if (!session) return;
              setStory(session);
              void persist(session);
            }}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
                <Text style={styles.primaryText}>Tekrar kaydet</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {snapshot.status === 'idle' && !snapshot.hasPendingSave ? (
          <Pressable style={styles.primary} onPress={() => void onStart()}>
            <Ionicons name="play" size={18} color={colors.white} />
            <Text style={styles.primaryText}>Sürüşe Başla</Text>
          </Pressable>
        ) : null}

        {active ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.secondary, saving && styles.disabled]}
              disabled={saving}
              onPress={() => void onPauseResume()}
            >
              <Ionicons
                name={snapshot.status === 'tracking' ? 'pause' : 'play'}
                size={16}
                color={colors.white}
              />
              <Text style={styles.secondaryText}>
                {snapshot.status === 'tracking' ? 'Duraklat' : 'Devam Et'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.primary, styles.finish, saving && styles.disabled]}
              disabled={saving}
              onPress={onFinish}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="flag" size={16} color={colors.white} />
                  <Text style={styles.primaryText}>Bitir ve Kaydet</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TelemetryTile({
  label,
  value,
  unit,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
  accent?: string;
}) {
  const tone = accent ?? (highlight ? colors.drive : undefined);
  return (
    <View style={[styles.tile, tone ? { borderColor: tone } : null]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.tileValueRow}>
        <Text style={[styles.tileValue, tone ? { color: tone } : null]}>{value}</Text>
        {unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    maxWidth: '58%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(225,6,0,0.55)',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  dashboard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    padding: 16,
    borderRadius: 28,
    backgroundColor: 'rgba(22,22,22,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tileLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  tileValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4, gap: 4 },
  tileValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  tileUnit: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.drive,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  finish: { flex: 2 },
  primaryText: { color: colors.white, fontWeight: '800' },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryText: { color: colors.text, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  saveBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.drive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBannerText: { color: colors.white, fontWeight: '800' },
});
