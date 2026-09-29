import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Image } from 'expo-image';
import { sweetAlert } from './SweetAlert';
import { MediaBoxSkeleton } from './ScreenSkeletons';
import { Ionicons } from '@expo/vector-icons';
import { mapAuthError } from '../lib/authErrors';
import { pickAndUpload, type MediaBucket } from '../lib/storage';
import { colors, radii, spacing } from '../theme/colors';

type Props = {
  label: string;
  bucket: MediaBucket;
  userId: string;
  value: string | null;
  onChange: (url: string) => void;
  aspect?: [number, number];
  height?: number;
  round?: boolean;
  prefix?: string;
  hint?: string;
};

export function ImageUploadField({
  label,
  bucket,
  userId,
  value,
  onChange,
  aspect = [1, 1],
  height = 160,
  round = false,
  prefix,
  hint = 'Galeriden seç veya kamera ile çek',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('Yükleniyor…');
  const [percent, setPercent] = useState(0);

  async function run(source: 'library' | 'camera') {
    setUploading(true);
    setPercent(0);
    setProgressMsg('Fotoğraf hazırlanıyor…');
    try {
      const url = await pickAndUpload({
        bucket,
        userId,
        source,
        aspect,
        prefix,
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
          options: ['İptal', 'Galeriden seç', 'Kamera ile çek'],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) void run('library');
          if (i === 2) void run('camera');
        },
      );
      return;
    }
    sweetAlert(label, hint, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Galeri', onPress: () => void run('library') },
      { text: 'Kamera', onPress: () => void run('camera') },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        disabled={uploading}
        style={[styles.box, { height }, round && styles.round]}
      >
        {uploading ? (
          <View style={[styles.loadingFill, { height }]}>
            <MediaBoxSkeleton height={Math.min(height - 40, 120)} />
            <Text style={styles.progressText}>{progressMsg}</Text>
            {percent > 0 ? (
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent}%` }]} />
              </View>
            ) : null}
          </View>
        ) : value ? (
          <>
            <Image
              source={{ uri: value }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={styles.badge}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.black} />
              <Text style={styles.badgeText}>Değiştir</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.loadingFill, { height }]}>
              <Ionicons name="camera-outline" size={28} color={colors.textDim} />
              <Text style={styles.hint}>{hint}</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.black} />
              <Text style={styles.badgeText}>Yükle</Text>
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
  round: {
    borderRadius: 999,
    width: 140,
    alignSelf: 'center',
    height: 140,
  },
  image: { width: '100%', height: '100%' },
  loadingFill: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
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
