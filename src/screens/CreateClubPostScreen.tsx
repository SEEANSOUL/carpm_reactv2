import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { CarpmLoader } from '../components/CarpmLoader';
import { FormScreenSkeleton } from '../components/ScreenSkeletons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ImageUploadField } from '../components/ImageUploadField';
import { KeyboardForm } from '../components/KeyboardAware';
import {
  createClubPost,
  fetchClubPost,
  isClubMember,
  updateClubPost,
} from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateClubPost'>;

export function CreateClubPostScreen({ navigation, route }: Props) {
  const { clubId, postId } = route.params;
  const isEdit = !!postId;
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!postId || !user) return;
    let alive = true;
    (async () => {
      try {
        const post = await fetchClubPost(postId, user.id);
        if (!alive || !post) return;
        setBody(post.body);
        setImageUrl(post.image_url || '');
      } catch (e) {
        sweetAlert('Hata', mapAuthError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [postId, user]);

  async function onPublish() {
    if (!user) return;
    if (!body.trim()) {
      sweetAlert('Eksik', 'Bir şeyler yaz.');
      return;
    }
    setBusy(true);
    try {
      const member = await isClubMember(clubId, user.id);
      if (!member) {
        sweetAlert('Üye değil', 'Forum yalnızca kulüp üyelerine açık.');
        return;
      }
      if (isEdit && postId) {
        await updateClubPost(postId, {
          body,
          image_url: imageUrl || null,
        });
        sweetAlert('Kaydedildi', 'Gönderi güncellendi.', [
          { text: 'Tamam', onPress: () => navigation.goBack() },
        ]);
      } else {
        await createClubPost({
          club_id: clubId,
          author_id: user.id,
          body,
          image_url: imageUrl || null,
        });
        sweetAlert('Paylaşıldı', 'Gönderin kulüp forumunda.', [
          { text: 'Tamam', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setBusy(false);
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Gönderiyi Düzenle' : 'Forum Gönderisi'}</Text>
        <Pressable onPress={onPublish} disabled={busy}>
          {busy ? (
            <CarpmLoader size="sm" tone="accent" />
          ) : (
            <Text style={styles.save}>{isEdit ? 'Kaydet' : 'Paylaş'}</Text>
          )}
        </Pressable>
      </View>

      <KeyboardForm contentContainerStyle={styles.form}>
        <Text style={styles.hint}>
          Sadece bu kulübün üyeleri görür. #etiket ile ayır (örn. #dyno #konvoy).
        </Text>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Ne paylaşmak istiyorsun?"
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={4000}
          textAlignVertical="top"
        />
        <ImageUploadField
          label="Fotoğraf (opsiyonel)"
          bucket="club-forum"
          userId={user.id}
          value={imageUrl || null}
          onChange={setImageUrl}
          aspect={[4, 3]}
          height={180}
        />
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
    paddingVertical: spacing.sm,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  save: { color: colors.accent, fontWeight: '800' },
  form: { padding: spacing.lg, gap: spacing.md },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 160,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
