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
import { updateProfile } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import { normalizeUsername } from '../lib/validation';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [title, setTitle] = useState(profile?.title ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (!user) return;
    const u = normalizeUsername(username);
    if (u.length < 3) {
      sweetAlert('Hata', 'Kullanıcı adı en az 3 karakter.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile(user.id, {
        full_name: fullName.trim(),
        username: u,
        bio: bio.trim(),
        title: title.trim(),
        avatar_url: avatarUrl || null,
      });
      await refreshProfile();
      sweetAlert('Kaydedildi', 'Profil güncellendi.');
      navigation.goBack();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Oturum gerekli</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Profili Düzenle</Text>
        <Pressable onPress={onSave} disabled={busy} hitSlop={12}>
          {busy ? (
            <CarpmLoader size="sm" tone="accent" />
          ) : (
            <Text style={styles.save}>Kaydet</Text>
          )}
        </Pressable>
      </View>
      <KeyboardForm contentContainerStyle={styles.form}>
        <ImageUploadField
          label="Profil Fotoğrafı"
          bucket="avatars"
          userId={user.id}
          value={avatarUrl || null}
          onChange={setAvatarUrl}
          aspect={[1, 1]}
          height={140}
          round
          hint="Profil fotoğrafı yükle"
        />
        <Field label="Ad Soyad" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <Field
          label="Kullanıcı adı"
          value={username}
          onChangeText={(t) => setUsername(normalizeUsername(t))}
          autoCapitalize="none"
        />
        <Field label="Ünvan" value={title} onChangeText={setTitle} autoCapitalize="words" />
        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholderTextColor={colors.textDim}
            placeholder="Kendinden bahset..."
          />
        </View>
      </KeyboardForm>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  autoCapitalize?: 'none' | 'words';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.textDim}
      />
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
