import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { sweetAlert } from './SweetAlert';
import { MediaBoxSkeleton } from './ScreenSkeletons';
import { mapAuthError } from '../lib/authErrors';
import { isVideoUrl } from '../lib/mediaUrl';
import { pickAndUpload, pickAndUploadVideo, type MediaBucket } from '../lib/storage';
import { colors, radii, spacing } from '../theme/colors';

type Props = {
  label: string;
  bucket: MediaBucket;
  userId: string;
  value: string | null;
  onChange: (url: string) => void;
  height?: number;
  aspect?: [number, number];
  hint?: string;
};

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    player.play();
  }, [player, uri]);

  return (
    <VideoView
      style={styles.media}
      player={player}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export function ShotMediaField({
  label,
  bucket,
  userId,
  value,
  onChange,
  height = 280,
  aspect = [9, 16],
  hint = 'Fotoğraf veya video · video max 60 sn / 50 MB',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('Yükleniyor…');
  const [percent, setPercent] = useState(0);
  const video = isVideoUrl(value);

  async function runPhoto(source: 'library' | 'camera') {
    setUploading(true);
    setPercent(0);
    setProgressMsg('Fotoğraf seçildi…');
    try {
      const url = await pickAndUpload({
        bucket,
        userId,
        source,
        aspect,
        onProgress: (p) => {
          setProgressMsg(p.message);
          if (p.percent != null) setPercent(p.percent);
        },
      });
      if (url) onChange(url);
    } catch (e) {
      sweetAlert('Yükleme hatası', mapAuthError(e));
    } finally {
      setUploading(false);
    }
  }

  async function runVideo(source: 'library' | 'camera') {
    setUploading(true);
    setPercent(0);
    setProgressMsg('Video hazırlanıyor… büyük dosya sürebilir');
    try {
      const url = await pickAndUploadVideo({
        bucket,
        userId,
        source,
        onProgress: (p) => {
          setProgressMsg(p.message);
          if (p.percent != null) setPercent(p.percent);
        },
      });
      if (url) onChange(url);
    } catch (e) {
      sweetAlert('Yükleme hatası', mapAuthError(e));
    } finally {
      setUploading(false);
    }
  }

  function openPicker() {
    if (uploading || !userId) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            'İptal',
            'Fotoğraf — Galeri',
            'Fotoğraf — Kamera',
            'Video — Galeri',
            'Video — Kamera',
          ],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) void runPhoto('library');
          if (i === 2) void runPhoto('camera');
          if (i === 3) void runVideo('library');
          if (i === 4) void runVideo('camera');
        },
      );
      return;
    }

    sweetAlert(label, hint, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Foto · Galeri', onPress: () => void runPhoto('library') },
      { text: 'Foto · Kamera', onPress: () => void runPhoto('camera') },
      { text: 'Video · Galeri', onPress: () => void runVideo('library') },
      { text: 'Video · Kamera', onPress: () => void runVideo('camera') },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        disabled={uploading}
        style={[styles.box, { height }]}
      >
        {uploading ? (
          <View style={[styles.loadingFill, { height }]}>
            <MediaBoxSkeleton height={Math.min(height - 48, 180)} />
            <Text style={styles.progressText}>{progressMsg}</Text>
            {percent > 0 ? (
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent}%` }]} />
              </View>
            ) : null}
          </View>
        ) : value ? (
          <>
            {video ? (
              <VideoPreview uri={value} />
            ) : (
              <Image
                source={{ uri: value }}
                style={styles.media}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            )}
            <View style={styles.badge}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.black} />
              <Text style={styles.badgeText}>Değiştir</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.loadingFill, { height }]}>
              <View style={styles.iconRow}>
                <Ionicons name="image-outline" size={28} color={colors.textDim} />
                <Ionicons name="videocam-outline" size={28} color={colors.textDim} />
              </View>
              <Text style={styles.hint}>{hint}</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.black} />
              <Text style={styles.badgeText}>Medya yükle</Text>
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  box: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  media: { width: '100%', height: '100%' },
  loadingFill: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  iconRow: { flexDirection: 'row', gap: 16 },
  hint: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  barTrack: {
    width: '70%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  badge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  badgeText: { color: colors.black, fontWeight: '800', fontSize: 12 },
});
