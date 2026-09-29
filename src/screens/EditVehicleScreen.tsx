import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ImageUploadField } from '../components/ImageUploadField';
import { KeyboardForm } from '../components/KeyboardAware';
import { createVehicle, deleteVehicle, updateVehicle } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../lib/authErrors';
import type { AppStackParamList } from '../navigation/AppStack';
import { colors, radii, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'EditVehicle'>;

export function EditVehicleScreen({ navigation, route }: Props) {
  const existing = route.params?.vehicle;
  const isEdit = !!existing;
  const { user, refreshProfile } = useAuth();

  const [make, setMake] = useState(existing?.make ?? '');
  const [model, setModel] = useState(existing?.model ?? '');
  const [year, setYear] = useState(existing?.year ? String(existing.year) : '');
  const [hp, setHp] = useState(existing?.hp != null ? String(existing.hp) : '');
  const [zero, setZero] = useState(
    existing?.zero_to_hundred != null ? String(existing.zero_to_hundred) : '',
  );
  const [engine, setEngine] = useState(existing?.engine_code ?? '');
  const [ecu, setEcu] = useState(existing?.ecu_map ?? '');
  const [imageUrl, setImageUrl] = useState(existing?.image_url ?? '');
  const [isActive, setIsActive] = useState(existing?.is_active ?? !isEdit);
  const [isMoto, setIsMoto] = useState(existing?.vehicle_type === 'motorcycle');
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (!user) return;
    if (!make.trim() || !model.trim()) {
      sweetAlert('Eksik', 'Marka ve model zorunlu.');
      return;
    }
    if (!imageUrl) {
      sweetAlert('Eksik', 'Araç fotoğrafı yükle.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        make: make.trim(),
        model: model.trim(),
        year: year ? Number(year) : null,
        hp: hp ? Number(hp) : null,
        zero_to_hundred: zero ? Number(zero) : null,
        engine_code: engine.trim() || null,
        ecu_map: ecu.trim() || null,
        image_url: imageUrl,
        is_active: isActive,
        vehicle_type: (isMoto ? 'motorcycle' : 'car') as 'car' | 'motorcycle',
      };
      if (isEdit && existing) {
        await updateVehicle(existing.id, user.id, payload);
      } else {
        await createVehicle({ owner_id: user.id, ...payload });
      }
      await refreshProfile();
      sweetAlert('Kaydedildi', isEdit ? 'Araç güncellendi.' : 'Araç eklendi.');
      navigation.goBack();
    } catch (e) {
      sweetAlert('Hata', mapAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    if (!user || !existing) return;
    sweetAlert('Sil', 'Bu araç silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteVehicle(existing.id, user.id);
            await refreshProfile();
            navigation.goBack();
          } catch (e) {
            sweetAlert('Hata', mapAuthError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Araç Düzenle' : 'Araç Ekle'}</Text>
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
          label="Araç Fotoğrafı"
          bucket="vehicles"
          userId={user.id}
          value={imageUrl || null}
          onChange={setImageUrl}
          aspect={[16, 9]}
          height={180}
          hint="Aracının net bir fotoğrafını yükle"
        />
        {[
          ['Marka *', make, setMake, false],
          ['Model *', model, setModel, false],
          ['Yıl', year, setYear, true],
          ['HP', hp, setHp, true],
          ['0-100 (sn)', zero, setZero, true],
          ['Motor kodu', engine, setEngine, false],
          ['ECU Map', ecu, setEcu, false],
        ].map(([label, value, setter, numeric]) => (
          <View key={String(label)} style={styles.field}>
            <Text style={styles.label}>{label as string}</Text>
            <TextInput
              style={styles.input}
              value={value as string}
              onChangeText={setter as (t: string) => void}
              placeholderTextColor={colors.textDim}
              keyboardType={numeric ? 'decimal-pad' : 'default'}
              autoCapitalize="none"
            />
          </View>
        ))}
        <View style={styles.row}>
          <Text style={styles.label}>Motosiklet</Text>
          <Switch value={isMoto} onValueChange={setIsMoto} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Aktif Canavar</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
        {isEdit ? (
          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>Aracı Sil</Text>
          </Pressable>
        ) : null}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  deleteBtn: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: colors.accent, fontWeight: '800' },
});
