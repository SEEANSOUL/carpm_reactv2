import React, { forwardRef, useImperativeHandle, useRef, useState, type ForwardedRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  EncodingType,
  cacheDirectory,
  deleteAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { RouteSketch } from './RouteSketch';
import { UserAvatar } from './UserAvatar';
import { formatDistanceKm, formatDurationStory, formatLiters, formatSpeedKmh, formatTry } from '../lib/driveFormat';
import { prepareDriveStoryPage } from '../lib/driveStoryPoster';
import { colors, radii } from '../theme/colors';

type Point = { latitude: number; longitude: number };

type Props = {
  name: string;
  avatarUrl?: string | null;
  distanceKm: number;
  durationSeconds: number;
  maxSpeedKmh: number;
  route: Point[];
  vehicleLabel?: string | null;
  vehicleImageUrl?: string | null;
  fuelLiters?: number | null;
  fuelCostTry?: number | null;
  fuelLPer100?: number | null;
  notice?: string | null;
  noticeBusy?: boolean;
  onNotice?: () => void;
  onShare?: () => void;
  sharing?: boolean;
  shared?: boolean;
  onClose: () => void;
};

export type DriveStoryCardHandle = {
  captureImage: () => Promise<string>;
};

type PosterJob = {
  resolve: (uri: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export const DriveStoryCard = forwardRef(function DriveStoryCard({
  name,
  avatarUrl,
  distanceKm,
  durationSeconds,
  maxSpeedKmh,
  route,
  vehicleLabel,
  vehicleImageUrl,
  fuelLiters,
  fuelCostTry,
  fuelLPer100,
  notice,
  noticeBusy,
  onNotice,
  onShare,
  sharing,
  shared,
  onClose,
}: Props,
ref: ForwardedRef<DriveStoryCardHandle>) {
  const insets = useSafeAreaInsets();
  const photo = vehicleImageUrl?.trim();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [photoSize, setPhotoSize] = useState({ width: 0, height: 0 });
  const [pageUri, setPageUri] = useState<string | null>(null);
  const pending = useRef<PosterJob | null>(null);

  function failPoster(message: string) {
    const job = pending.current;
    if (!job) return;
    clearTimeout(job.timer);
    pending.current = null;
    setPageUri(null);
    job.reject(new Error(message));
  }

  useImperativeHandle(ref, () => ({
    captureImage: () =>
      new Promise((resolve, reject) => {
        if (!photo) {
          reject(new Error('Fotoğrafsız paylaşılmaz'));
          return;
        }
        const timer = setTimeout(() => failPoster('Kart görseli oluşmadı.'), 20000);
        pending.current = { resolve, reject, timer };
        const ledgerLine = vehicleLabel
          ? `${formatLiters(fuelLiters ?? 0)} L${fuelLPer100 ? ` · ${formatLiters(fuelLPer100)} L/100` : ''} · ${formatTry(fuelCostTry ?? 0)} TL`
          : null;
        void prepareDriveStoryPage({
          photoUrl: photo,
          name,
          distance: formatDistanceKm(distanceKm),
          duration: formatDurationStory(durationSeconds),
          maxSpeed: formatSpeedKmh(maxSpeedKmh),
          vehicleLabel,
          ledgerLine,
          points: route,
        })
          .then((path) => {
            if (!pending.current) return;
            setPageUri(path);
          })
          .catch((error: unknown) => {
            failPoster(error instanceof Error ? error.message : 'Kart görseli oluşmadı.');
          });
      }),
  }));

  async function onPosterMessage(event: WebViewMessageEvent) {
    const data = event.nativeEvent.data;
    const job = pending.current;
    if (pageUri) void deleteAsync(pageUri, { idempotent: true }).catch(() => undefined);
    if (!job) return;
    if (!data.startsWith('data:image/jpeg;base64,/9j')) {
      failPoster(data.startsWith('ERR:') ? data.slice(4) : 'Kart görseli oluşmadı.');
      return;
    }
    try {
      if (!cacheDirectory) throw new Error('Kart görseli oluşmadı.');
      const base64 = data.slice(data.indexOf(',') + 1);
      const uri = `${cacheDirectory}drive-story-${Date.now()}.jpg`;
      await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
      clearTimeout(job.timer);
      pending.current = null;
      setPageUri(null);
      job.resolve(uri);
    } catch (error) {
      failPoster(error instanceof Error ? error.message : 'Kart görseli oluşmadı.');
    }
  }

  const fitted =
    photoSize.width > 0 && photoSize.height > 0 && frame.width > 0 && frame.height > 0
      ? fitContain(frame.width, frame.height, photoSize.width, photoSize.height)
      : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.top}>
          <UserAvatar uri={avatarUrl} name={name} size={32} />
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={18} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <StoryStat label="Mesafe" value={formatDistanceKm(distanceKm)} unit="km" />
          <StoryStat label="Süre" value={formatDurationStory(durationSeconds)} />
          <StoryStat label="Maks" value={formatSpeedKmh(maxSpeedKmh)} unit="km/h" />
        </View>
        <Text style={styles.brand}>CARPM</Text>

        <View
          style={styles.photoFrame}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (width > 40 && height > 40 && (width !== frame.width || height !== frame.height)) {
              setFrame({ width, height });
            }
          }}
        >
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              onLoad={(event) => {
                const width = event.source?.width ?? 0;
                const height = event.source?.height ?? 0;
                if (width > 0 && height > 0) setPhotoSize({ width, height });
              }}
            />
          ) : null}
          {fitted ? (
            <View
              pointerEvents="none"
              style={[
                styles.routeOnPhoto,
                { left: fitted.x, top: fitted.y, width: fitted.width, height: fitted.height },
              ]}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)']}
                style={StyleSheet.absoluteFill}
              />
              <RouteSketch points={route} height={Math.floor(fitted.height)} variant="story" />
            </View>
          ) : null}
        </View>

        {vehicleLabel ? (
          <View style={styles.ledger}>
            <Text style={styles.ledgerCar} numberOfLines={1}>
              {vehicleLabel}
            </Text>
            <Text style={styles.ledgerLine} numberOfLines={1}>
              {formatLiters(fuelLiters ?? 0)} L
              {fuelLPer100 ? ` · ${formatLiters(fuelLPer100)} L/100` : ''}
              {' · '}
              {formatTry(fuelCostTry ?? 0)} TL
            </Text>
          </View>
        ) : null}

        {notice ? (
          <Pressable style={styles.notice} disabled={noticeBusy} onPress={onNotice}>
            {noticeBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.noticeText} numberOfLines={2}>
                {notice.includes('Rota oluşmadı') ? 'Kapat' : notice}
              </Text>
            )}
          </Pressable>
        ) : null}

        {onShare ? (
          <Pressable
            style={[styles.share, (sharing || shared || !photo) && styles.shareOff]}
            disabled={sharing || shared || !photo}
            onPress={onShare}
          >
            {sharing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name={shared ? 'checkmark' : 'paper-plane'} size={16} color={colors.white} />
                <Text style={styles.shareText}>
                  {shared ? 'Shots’a düştü' : photo ? 'Shots’ta paylaş' : 'Fotoğrafsız paylaşılmaz'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
      {pageUri ? (
        <WebView
          source={{ uri: pageUri }}
          originWhitelist={['*']}
          allowFileAccess
          allowingReadAccessToURL={cacheDirectory ?? undefined}
          javaScriptEnabled
          androidLayerType="software"
          onMessage={(event) => {
            void onPosterMessage(event);
          }}
          onError={() => failPoster('Kart görseli oluşmadı.')}
          style={styles.poster}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
});

function fitContain(frameWidth: number, frameHeight: number, imageWidth: number, imageHeight: number) {
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (frameWidth - width) / 2,
    y: (frameHeight - height) / 2,
    width,
    height,
  };
}

function StoryStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  poster: {
    position: 'absolute',
    width: 1080,
    height: 1920,
    left: -4000,
    top: 0,
    opacity: 0.01,
  },
  body: { flex: 1, paddingHorizontal: 16 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  name: { flex: 1, color: colors.white, fontSize: 16, fontWeight: '700' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  stat: { flex: 1, gap: 2 },
  statLabel: { color: '#E8E8E8', fontSize: 13, fontWeight: '600' },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, flexWrap: 'nowrap' },
  statValue: { color: colors.white, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  statUnit: { color: colors.white, fontSize: 12, fontWeight: '700', marginBottom: 3, flexShrink: 0 },
  brand: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 8,
    marginBottom: 10,
  },
  photoFrame: { flex: 1, backgroundColor: '#000000', marginBottom: 10 },
  routeOnPhoto: { position: 'absolute', overflow: 'hidden' },
  ledger: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(225,6,0,0.45)',
    marginBottom: 8,
  },
  ledgerCar: { color: colors.white, fontWeight: '800' },
  ledgerLine: { color: '#E8E8E8', fontWeight: '600', marginTop: 2 },
  notice: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.drive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  noticeText: { color: colors.white, fontWeight: '800', textAlign: 'center' },
  share: {
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.drive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareOff: { opacity: 0.7 },
  shareText: { color: colors.white, fontWeight: '800' },
});
