import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import { sweetAlert } from '../components/SweetAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  addShotComment,
  deleteShotComment,
  fetchShotComments,
  type ShotComment,
} from '../api/carpm';
import { EmptyState } from '../components/EmptyState';
import { ListRowsSkeleton } from '../components/ScreenSkeletons';
import { KeyboardSheet } from '../components/KeyboardAware';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'Comments'>;

export function CommentsScreen({ navigation, route }: Props) {
  const { shotId } = route.params;
  const { user } = useAuth();
  const [comments, setComments] = useState<ShotComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setComments(await fetchShotComments(shotId));
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setLoading(false);
    }
  }, [shotId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSend() {
    if (!user) return;
    if (!body.trim()) {
      sweetAlert('Eksik', 'Yorum yaz, sonra gönder.');
      return;
    }
    setSending(true);
    try {
      const c = await addShotComment(shotId, user.id, body);
      setComments((prev) => [...prev, c]);
      setBody('');
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setSending(false);
    }
  }

  function onDelete(c: ShotComment) {
    if (!user) return;
    sweetAlert('Sil', 'Yorum silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShotComment(c.id, user.id, shotId);
            setComments((prev) => prev.filter((x) => x.id !== c.id));
          } catch (e) {
            sweetAlert('Hata', mapAuthError(e));
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Yorumlar</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardSheet
        footer={
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={body}
              onChangeText={setBody}
              placeholder="Yorum yaz..."
              placeholderTextColor={colors.textDim}
            />
            <Pressable style={styles.send} onPress={onSend} disabled={sending}>
              <Ionicons name="send" size={18} color={colors.white} />
            </Pressable>
          </View>
        }
      >
        {loading ? (
          <ListRowsSkeleton rows={5} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-outline"
                title="Henüz yorum yok"
                subtitle="İlk yorumu sen yaz."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onLongPress={() => {
                  if (item.user_id === user?.id) onDelete(item);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.user}>@{item.user?.username || 'pilot'}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                </View>
                {item.user_id === user?.id ? (
                  <Ionicons name="trash-outline" size={16} color={colors.textDim} />
                ) : null}
              </Pressable>
            )}
          />
        )}
      </KeyboardSheet>
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
  list: { padding: spacing.lg, paddingBottom: 20, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  user: { color: colors.text, fontWeight: '800', marginBottom: 4 },
  body: { color: colors.textMuted, lineHeight: 20 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
