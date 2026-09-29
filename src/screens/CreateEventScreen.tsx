import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { CarpmLoader } from '../components/CarpmLoader';
import { FormScreenSkeleton } from '../components/ScreenSkeletons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardForm } from '../components/KeyboardAware';
import { createEvent, fetchClub, fetchEvent, updateEvent } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateEvent'>;

export function CreateEventScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const clubId = route.params?.clubId ?? null;
  const eventId = route.params?.eventId;
  const isEdit = !!eventId;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [location, setLocation] = useState('');
  const [hoursFromNow, setHoursFromNow] = useState('48');
  const [startIso, setStartIso] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [type, setType] = useState<'meetup' | 'convoy' | 'track_day'>('meetup');
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [clubName, setClubName] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user || !clubId) {
        if (alive) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }
      try {
        const club = await fetchClub(clubId);
        if (!alive) return;
        setClubName(club?.name ?? '');
        setAllowed(!!club && club.created_by === user.id);

        if (eventId) {
          const ev = await fetchEvent(eventId);
          if (!alive || !ev) return;
          setTitle(ev.title);
          setSubtitle(ev.subtitle || '');
          setLocation(ev.location_name || '');
          setIsLive(!!ev.is_live);
          setStartIso(ev.start_time);
          const hours = Math.max(
            1,
            Math.round((new Date(ev.start_time).getTime() - Date.now()) / 3600000),
          );
          setHoursFromNow(String(hours));
          if (
            ev.event_type === 'meetup' ||
            ev.event_type === 'convoy' ||
            ev.event_type === 'track_day'
          ) {
            setType(ev.event_type);
          }
        }
      } catch {
        if (alive) setAllowed(false);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, clubId, eventId]);

  async function onSave() {
    if (!user || !clubId) return;
    if (!allowed) {
      sweetAlert('Yetki yok', 'Etkinliği sadece kulüp kurucusu yönetebilir.');
      return;
    }
    if (!title.trim()) {
      sweetAlert('Eksik', 'Etkinlik başlığı gerekli.');
      return;
    }
    const hours = Number(hoursFromNow) || 48;
    const start =
      isEdit && startIso && hours === Number(hoursFromNow)
        ? // if user changed hours field, recompute; else keep if still future
          new Date(Date.now() + hours * 3600 * 1000).toISOString()
        : new Date(Date.now() + hours * 3600 * 1000).toISOString();

    setBusy(true);
    try {
      if (isEdit && eventId) {
        await updateEvent(eventId, user.id, {
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          location_name: location.trim() || null,
          start_time: start,
          event_type: type,
          is_live: isLive,
          is_featured: true,
        });
        sweetAlert('Kaydedildi', 'Etkinlik güncellendi.');
      } else {
        await createEvent({
          created_by: user.id,
          club_id: clubId,
          title,
          subtitle,
          location_name: location,
          start_time: start,
          event_type: type,
          is_live: isLive,
          is_featured: true,
        });
        sweetAlert('Tamam', 'Etkinlik oluşturuldu.');
      }
      navigation.goBack();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.safe}>
        <FormScreenSkeleton />
      </SafeAreaView>
    );
  }

  if (!clubId || !allowed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Etkinlik</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.blocked}>
          <Ionicons name="shield-checkmark-outline" size={36} color={colors.textDim} />
          <Text style={styles.blockedTitle}>Sadece kurucu</Text>
          <Text style={styles.blockedSub}>
            Kulüp etkinliğini yalnızca o kulübü kuran kişi oluşturabilir veya
            düzenleyebilir.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {isEdit ? 'Etkinliği Düzenle' : clubName || 'Etkinlik'}
        </Text>
        <Pressable onPress={onSave} disabled={busy}>
          {busy ? (
            <CarpmLoader size="sm" tone="accent" />
          ) : (
            <Text style={styles.save}>Kaydet</Text>
          )}
        </Pressable>
      </View>
      <KeyboardForm contentContainerStyle={styles.form}>
        <Text style={styles.ownerHint}>
          {isEdit ? 'Kurucu olarak etkinliği düzenliyorsun' : 'Kurucu olarak etkinlik oluşturuyorsun'}
        </Text>
        <View style={styles.field}>
          <Text style={styles.label}>Başlık</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={colors.textDim}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Alt başlık</Text>
          <TextInput
            style={styles.input}
            value={subtitle}
            onChangeText={setSubtitle}
            placeholderTextColor={colors.textDim}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Konum</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholderTextColor={colors.textDim}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Kaç saat sonra başlasın?</Text>
          <TextInput
            style={styles.input}
            value={hoursFromNow}
            onChangeText={setHoursFromNow}
            keyboardType="number-pad"
            placeholderTextColor={colors.textDim}
          />
        </View>
        <View style={styles.typeRow}>
          {(['meetup', 'convoy', 'track_day'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[styles.typeChip, type === t && styles.typeOn]}
            >
              <Text style={[styles.typeText, type === t && styles.typeTextOn]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Canlı buluşma</Text>
          <Switch value={isLive} onValueChange={setIsLive} />
        </View>
      </KeyboardForm>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  title: { flex: 1, color: colors.text, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  save: { color: colors.accent, fontWeight: '800' },
  form: { padding: spacing.lg, gap: spacing.md },
  ownerHint: { color: colors.textMuted, fontSize: 13 },
  field: { gap: 6 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeOn: { backgroundColor: colors.white, borderColor: colors.white },
  typeText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  typeTextOn: { color: colors.black },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 10,
  },
  blockedTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
  blockedSub: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
  },
});
