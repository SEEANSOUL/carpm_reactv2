import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { CarpmLoader } from '../components/CarpmLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ImageUploadField } from '../components/ImageUploadField';
import { KeyboardForm } from '../components/KeyboardAware';
import { createClub } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateClub'>;

export function CreateClubScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (!user) return;
    if (name.trim().length < 3) {
      sweetAlert('Eksik', 'Kulüp adı en az 3 karakter.');
      return;
    }
    if (!bannerUrl) {
      sweetAlert('Eksik', 'Kulüp kapak fotoğrafı yükle.');
      return;
    }
    setBusy(true);
    try {
      await createClub({
        created_by: user.id,
        name,
        location,
        description,
        banner_url: bannerUrl,
        logo_url: logoUrl || bannerUrl,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      sweetAlert('Tamam', 'Kulüp oluşturuldu.');
      navigation.goBack();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Kulüp Oluştur</Text>
        <Pressable onPress={onSave} disabled={busy}>
          {busy ? (
            <CarpmLoader size="sm" tone="accent" />
          ) : (
            <Text style={styles.save}>Kaydet</Text>
          )}
        </Pressable>
      </View>
      <KeyboardForm contentContainerStyle={styles.form}>
        <ImageUploadField
          label="Kapak Fotoğrafı *"
          bucket="club-banners"
          userId={user.id}
          value={bannerUrl || null}
          onChange={setBannerUrl}
          aspect={[16, 9]}
          height={180}
          prefix="banners"
        />
        <ImageUploadField
          label="Logo (opsiyonel)"
          bucket="club-banners"
          userId={user.id}
          value={logoUrl || null}
          onChange={setLogoUrl}
          aspect={[1, 1]}
          height={120}
          prefix="logos"
        />
        {[
          ['Kulüp adı *', name, setName],
          ['Şehir', location, setLocation],
          ['Etiketler (virgülle)', tags, setTags],
        ].map(([label, value, setter]) => (
          <View key={String(label)} style={styles.field}>
            <Text style={styles.label}>{label as string}</Text>
            <TextInput
              style={styles.input}
              value={value as string}
              onChangeText={setter as (t: string) => void}
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
            />
          </View>
        ))}
        <View style={styles.field}>
          <Text style={styles.label}>Açıklama</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor={colors.textDim}
          />
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
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  save: { color: colors.accent, fontWeight: '800' },
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
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
  area: { minHeight: 100, textAlignVertical: 'top' },
});
