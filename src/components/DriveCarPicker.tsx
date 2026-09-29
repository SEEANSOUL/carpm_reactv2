import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchMyVehicles, updateVehicle } from '../api/carpm';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { driveTracker } from '../lib/driveTracker';
import type { Vehicle } from '../types/models';
import { colors, radii } from '../theme/colors';

type Props = {
  userId: string;
  onReady: () => void;
};

function parseNum(raw: string) {
  const value = Number(raw.replace(',', '.').trim());
  return Number.isFinite(value) ? value : 0;
}

export function DriveCarPicker({ userId, onReady }: Props) {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchMyVehicles(userId)
      .then((rows) => {
        if (!alive) return;
        setVehicles(rows);
        const active = rows.find((car) => car.is_active) ?? rows[0];
        if (active) selectCar(active);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Garaj yüklenemedi.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  function selectCar(car: Vehicle) {
    setSelectedId(car.id);
    setLiters(car.fuel_l_per_100km != null ? String(car.fuel_l_per_100km) : '');
    setPrice(car.fuel_price_try != null ? String(car.fuel_price_try) : '');
    setError(null);
  }

  async function onContinue() {
    const car = vehicles.find((item) => item.id === selectedId);
    const lPer100km = parseNum(liters);
    const priceTry = parseNum(price);
    if (!car) {
      setError('Garajdan bir araba seç.');
      return;
    }
    if (lPer100km < 1 || lPer100km > 40) {
      setError('Tüketimi 1 ile 40 L/100 km arasında yaz.');
      return;
    }
    if (priceTry < 1 || priceTry > 250) {
      setError('Litre fiyatını yaz. Masraf bu fiyattan hesaplanır.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateVehicle(car.id, userId, {
        fuel_l_per_100km: Number(lPer100km.toFixed(2)),
        fuel_price_try: Number(priceTry.toFixed(2)),
      });
    } catch {
      // Kolon henüz yoksa sürüş yine bu değerlerle devam eder.
    }
    driveTracker.setVehicle({
      id: car.id,
      label: `${car.make} ${car.model}`.trim(),
      imageUrl: car.image_url,
      lPer100km,
      priceTry,
    });
    setSaving(false);
    onReady();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Hangi arabayla?</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.drive} style={styles.loader} />
      ) : vehicles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Garaj boş</Text>
          <Text style={styles.emptySub}>Sürüşe çıkmadan önce bir araba ekle.</Text>
          <Pressable
            style={styles.primary}
            onPress={() => navigation.navigate('Tabs', { screen: 'Garage' })}
          >
            <Text style={styles.primaryText}>Garaja git</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {vehicles.map((car) => {
            const selected = car.id === selectedId;
            return (
              <Pressable
                key={car.id}
                style={[styles.car, selected && styles.carOn]}
                onPress={() => selectCar(car)}
              >
                {car.image_url ? (
                  <Image source={{ uri: car.image_url }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={styles.photoFallback}>
                    <Ionicons name="car-sport" size={22} color={colors.white} />
                  </View>
                )}
                <View style={styles.carCopy}>
                  <Text style={styles.carName} numberOfLines={1}>
                    {car.make} {car.model}
                  </Text>
                  <Text style={styles.carMeta}>
                    {[car.year, car.hp ? `${car.hp} HP` : null].filter(Boolean).join(' · ') || 'Garaj'}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.drive} /> : null}
              </Pressable>
            );
          })}

          <Text style={styles.section}>Masraf defteri</Text>
          <Text style={styles.hint}>
            Yakıt, bu arabanın tüketimi ve litre fiyatıyla hesaplanır. Sürüş bitince masrafa yazılır.
          </Text>
          <View style={styles.fields}>
            <Field label="L / 100 km" value={liters} onChangeText={setLiters} placeholder="8.5" />
            <Field label="TL / litre" value={price} onChangeText={setPrice} placeholder="54" />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.primary, saving && styles.disabled]} disabled={saving} onPress={() => void onContinue()}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryText}>Bu arabayla devam et</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType="decimal-pad"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingHorizontal: 16,
    marginBottom: 8,
    height: 42,
    justifyContent: 'center',
  },
  title: { color: colors.white, fontSize: 18, fontWeight: '800' },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 120, gap: 10 },
  car: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.lg,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  carOn: { borderColor: colors.drive },
  photo: { width: 72, height: 52, borderRadius: 10 },
  photoFallback: {
    width: 72,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carCopy: { flex: 1 },
  carName: { color: colors.white, fontWeight: '800' },
  carMeta: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  section: { color: colors.white, fontWeight: '800', marginTop: 12, fontSize: 16 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  fields: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  input: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: colors.white,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  error: { color: colors.driveTerracotta, fontWeight: '700' },
  primary: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.drive,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  emptySub: { color: colors.textMuted, textAlign: 'center' },
});
