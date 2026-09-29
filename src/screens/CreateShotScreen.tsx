import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  Switch,
  Keyboard,
  type TextInput as TextInputType,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { FormScreenSkeleton } from '../components/ScreenSkeletons';
import { CarpmLoader } from '../components/CarpmLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ShotMediaField } from '../components/ShotMediaField';
import { KeyboardForm } from '../components/KeyboardAware';
import { fetchClubs, fetchMyVehicles, publishShot } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { mapAuthError } from '../lib/authErrors';
import { isVideoUrl } from '../lib/mediaUrl';
import type { Club, Vehicle } from '../types/models';
import { colors, radii, spacing } from '../theme/colors';

const AUDIO_LABELS = {
  none: 'Yok',
  original: 'Orijinal Egzoz Sesi',
  soundbank: 'Cold Start Soundbank V4',
} as const;

export function CreateShotScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const captionRef = useRef<TextInputType>(null);
  const captionCardY = useRef(0);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [telemetryOn, setTelemetryOn] = useState(false);
  const [destination, setDestination] = useState<'club' | 'explore'>('explore');
  const [audio, setAudio] = useState<'none' | 'original' | 'soundbank'>('none');
  const [audioOpen, setAudioOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [captionFocused, setCaptionFocused] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const activeVehicle = vehicleId
    ? vehicles.find((v) => v.id === vehicleId) ?? null
    : null;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [v, c] = await Promise.all([
        fetchMyVehicles(user.id),
        fetchClubs().catch(() => [] as Club[]),
      ]);
      setVehicles(v);
      setClubs(c);
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void load();
    });
    void load();
    return unsub;
  }, [load, navigation]);

  async function onPublish() {
    if (!user) return;
    if (!mediaUrl) {
      sweetAlert('Eksik', 'Fotoğraf veya video yükle.');
      return;
    }
    if (!caption.trim()) {
      sweetAlert('Eksik', 'Açıklama yaz.');
      return;
    }
    if (destination === 'club' && !clubId) {
      sweetAlert('Eksik', 'Kulüp seç veya Keşfet hedefini kullan.');
      return;
    }

    setPublishing(true);
    try {
      const tags = (caption.match(/#[\wğüşıöçĞÜŞİÖÇ]+/gi) ?? []).map((t) =>
        t.toLowerCase(),
      );

      const audioTitle =
        audio === 'original'
          ? 'Orijinal Egzoz Sesi'
          : audio === 'soundbank'
            ? 'Cold Start Soundbank V4'
            : null;

      const useVehicle = !!activeVehicle;
      const useTelemetry = useVehicle && telemetryOn;

      await publishShot({
        creator_id: user.id,
        vehicle_id: useVehicle ? activeVehicle.id : null,
        club_id: destination === 'club' ? clubId : null,
        caption: caption.trim(),
        hashtags: tags,
        video_url: mediaUrl,
        thumbnail_url: isVideoUrl(mediaUrl) ? null : mediaUrl,
        audio_title: audioTitle,
        audio_source: audio === 'none' ? null : audio,
        destination: destination === 'club' ? 'club' : 'explore',
        telemetry_enabled: useTelemetry,
        zero_to_hundred: useTelemetry ? activeVehicle.zero_to_hundred ?? null : null,
        dyno_whp: useTelemetry ? activeVehicle.hp ?? null : null,
        exhaust_db: useTelemetry ? activeVehicle.exhaust_db ?? null : null,
        ecu_map: useTelemetry ? activeVehicle.ecu_map ?? null : null,
      });
      setCaption('');
      setMediaUrl('');
      setVehicleId(null);
      setAudio('none');
      setTelemetryOn(false);
      sweetAlert('Paylaşıldı', 'Shot feed’e düştü.', [
        {
          text: 'Tamam',
          onPress: () => navigation.navigate('Tabs', { screen: 'Shots' }),
        },
      ]);
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setPublishing(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <FormScreenSkeleton />
      </SafeAreaView>
    );
  }

  const publishFooter = (
    <View style={styles.bottomBarInner}>
      <Pressable
        style={[styles.publishBtn, publishing && { opacity: 0.7 }]}
        onPress={onPublish}
        disabled={publishing}
      >
        {publishing ? (
          <CarpmLoader size="sm" tone="light" />
        ) : (
          <>
            <Ionicons name="paper-plane" size={18} color={colors.white} />
            <Text style={styles.publishText}>SHOTS OLARAK PAYLAŞ</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate('Tabs', { screen: 'Shots' });
          }}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Yeni Shot</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardForm
        scrollRef={scrollRef}
        contentContainerStyle={styles.content}
        footer={publishFooter}
      >
          <ShotMediaField
            label="Shot Medyası *"
            bucket="shots"
            userId={user.id}
            value={mediaUrl || null}
            onChange={setMediaUrl}
            height={280}
            aspect={[9, 16]}
            hint="Fotoğraf veya video · video max 60 sn / 50 MB"
          />

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardHeadTitle}>Araç Seçimi (opsiyonel)</Text>
            </View>
            {vehicles.length === 0 ? (
              <Text style={styles.optionalHint}>
                Garajında araç yok — yine de paylaşabilirsin. İstersen araç ekle.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable
                  onPress={() => {
                    setVehicleId(null);
                    setTelemetryOn(false);
                  }}
                  style={[styles.vehiclePick, !vehicleId && styles.vehiclePickActive]}
                >
                  <View style={[styles.vehicleThumb, styles.noneThumb]}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </View>
                  <Text style={styles.vehicleName}>Seçme</Text>
                </Pressable>
                {vehicles.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() =>
                      setVehicleId((prev) => (prev === v.id ? null : v.id))
                    }
                    style={[
                      styles.vehiclePick,
                      vehicleId === v.id && styles.vehiclePickActive,
                    ]}
                  >
                    {v.image_url ? (
                      <Image source={{ uri: v.image_url }} style={styles.vehicleThumb} />
                    ) : (
                      <View style={[styles.vehicleThumb, styles.thumbFallback]} />
                    )}
                    <Text style={styles.vehicleName} numberOfLines={1}>
                      {v.make} {v.model}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {activeVehicle ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardHeadTitle}>Telemetri</Text>
                <Switch
                  value={telemetryOn}
                  onValueChange={setTelemetryOn}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.white}
                />
              </View>
              {telemetryOn ? (
                <View style={styles.grid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>0-100</Text>
                    <Text style={styles.gridVal}>
                      {activeVehicle.zero_to_hundred ?? '—'} sn
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>DYNO</Text>
                    <Text style={styles.gridVal}>{activeVehicle.hp ?? '—'} HP</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.optionalHint}>Kapalı — telemetri yazılmaz.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardHeadTitle}>Yayın Hedefi</Text>
            <View style={styles.destRow}>
              <Pressable
                onPress={() => setDestination('club')}
                style={[styles.destCard, destination === 'club' && styles.destActive]}
              >
                <Text style={styles.destTitle}>KULÜP</Text>
                <Text style={styles.destName}>
                  {clubs.find((c) => c.id === clubId)?.name || 'Kulüp yok'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDestination('explore')}
                style={[styles.destCard, destination === 'explore' && styles.destActive]}
              >
                <Text style={styles.destTitle}>KEŞFET</Text>
                <Text style={styles.destName}>Genel Shots</Text>
              </Pressable>
            </View>
            {destination === 'club' && clubs.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {clubs.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setClubId(c.id)}
                    style={[styles.clubChip, clubId === c.id && styles.clubChipOn]}
                  >
                    <Text
                      style={[
                        styles.clubChipText,
                        clubId === c.id && styles.clubChipTextOn,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {/* Audio — açılır / kapanır */}
          <View style={[styles.card, audioOpen && styles.cardFocused]}>
            <Pressable
              onPress={() => setAudioOpen((v) => !v)}
              style={styles.audioHeader}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>Audio (opsiyonel)</Text>
                {audioOpen ? (
                  <Text style={styles.openHintActive}>
                    Seçili: {AUDIO_LABELS[audio]}
                  </Text>
                ) : (
                  <Text style={styles.openHint}>
                    Dokunarak aç · ses seçimi yapabilirsin
                  </Text>
                )}
              </View>
              <Ionicons
                name={audioOpen ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={audioOpen ? colors.white : colors.textMuted}
              />
            </Pressable>

            {audioOpen
              ? (
                  [
                    ['none', 'Yok'],
                    ['original', 'Orijinal Egzoz Sesi'],
                    ['soundbank', 'Cold Start Soundbank V4'],
                  ] as const
                ).map(([key, title]) => (
                  <Pressable
                    key={key}
                    style={styles.audioOption}
                    onPress={() => setAudio(key)}
                  >
                    <Text style={styles.audioOptTitle}>{title}</Text>
                    <View style={[styles.radio, audio === key && styles.radioOn]} />
                  </Pressable>
                ))
              : null}
          </View>

          <View
            style={[styles.card, captionFocused && styles.cardFocused]}
            onLayout={(e) => {
              captionCardY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.cardHeadTitle}>Açıklama *</Text>
            {captionFocused ? (
              <Text style={styles.openHintActive}>Yazmaya devam et — paylaş butonu görünür</Text>
            ) : (
              <Text style={styles.openHint}>Dokunarak yaz</Text>
            )}
            <TextInput
              ref={captionRef}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={240}
              style={styles.captionInput}
              placeholder="Tünel seansı, dyno, konvoy... #hashtag"
              placeholderTextColor={colors.textDim}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
            onFocus={() => {
              setCaptionFocused(true);
              setTimeout(() => {
                scrollRef.current?.scrollTo({
                  y: Math.max(0, captionCardY.current - 16),
                  animated: true,
                });
              }, 280);
            }}
            onBlur={() => setCaptionFocused(false)}
          />
          <Text style={styles.charCount}>{caption.length}/240</Text>
        </View>
      </KeyboardForm>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  topTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeadTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  cardFocused: {
    borderColor: colors.white,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  openHint: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 4,
  },
  openHintActive: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  vehiclePick: {
    width: 120,
    marginRight: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    backgroundColor: colors.bgElevated,
  },
  vehiclePickActive: { borderColor: colors.white },
  vehicleThumb: { width: '100%', height: 64, borderRadius: radii.sm, marginBottom: 6 },
  noneThumb: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbFallback: { backgroundColor: colors.border },
  vehicleName: { color: colors.text, fontWeight: '700', fontSize: 12 },
  optionalHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', gap: spacing.sm },
  gridItem: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  gridLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  gridVal: { color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 4 },
  destRow: { flexDirection: 'row', gap: spacing.sm },
  destCard: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destActive: { borderColor: colors.white },
  destTitle: { color: colors.textDim, fontSize: 10, fontWeight: '800' },
  destName: { color: colors.text, fontWeight: '800', marginTop: 6 },
  clubChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  clubChipOn: { borderColor: colors.white, backgroundColor: colors.white },
  clubChipText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  clubChipTextOn: { color: colors.black },
  audioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  audioOptTitle: { color: colors.text, fontWeight: '700' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioOn: { borderColor: colors.blue, backgroundColor: colors.blue },
  captionInput: {
    minHeight: 110,
    maxHeight: 160,
    color: colors.text,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  charCount: { color: colors.textDim, fontSize: 12, alignSelf: 'flex-end' },
  bottomBarInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  publishBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishText: { color: colors.white, fontWeight: '900', fontSize: 13 },
});
