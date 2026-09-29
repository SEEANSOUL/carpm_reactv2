import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { sweetAlert } from '../../components/SweetAlert';
import { CarpmLoader } from '../../components/CarpmLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthInput } from '../../components/AuthInput';
import { KeyboardForm } from '../../components/KeyboardAware';
import { useAuth } from '../../context/AuthContext';
import { useExitConfirm } from '../../hooks/useExitConfirm';
import { mapAuthError } from '../../lib/authErrors';
import { hasErrors, validateLogin } from '../../lib/validation';
import { colors, radii, spacing } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  useExitConfirm();
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    if (!configured) {
      setFormError(
        'Supabase bağlı değil. .env dosyasına EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ekle, Expo’yu yeniden başlat.',
      );
      return;
    }

    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setFormError(mapAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardForm contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Image source={require('../../../assets/icon.png')} style={styles.appLogo} />
          <Text style={styles.logo}>CaRPM</Text>
          <Text style={styles.sub}>Pilot hesabına giriş yap</Text>
        </View>

        {!configured ? (
          <View style={styles.warn}>
            <Ionicons name="warning-outline" size={16} color={colors.gold} />
            <Text style={styles.warnText}>
              Supabase env eksik — giriş çalışmaz. `.env` dosyasını kontrol et.
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <AuthInput
            label="E-POSTA"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@mail.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            error={fieldErrors.email}
          />
          <AuthInput
            label="ŞİFRE"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            isPassword
            textContentType="password"
            autoComplete="password"
            error={fieldErrors.password}
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? (
              <CarpmLoader size="sm" tone="dark" />
            ) : (
              <Text style={styles.primaryText}>Giriş Yap</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              sweetAlert(
                'Şifre sıfırlama',
                'Şimdilik Supabase Dashboard → Authentication → Users üzerinden şifre sıfırlayabilirsin.',
              )
            }
          >
            <Text style={styles.linkMuted}>Şifremi unuttum</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.switchRow}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.switchText}>Hesabın yok mu? </Text>
          <Text style={styles.switchLink}>Kayıt Ol</Text>
        </Pressable>
      </KeyboardForm>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  brand: { alignItems: 'center', gap: 8 },
  appLogo: {
    width: 88,
    height: 88,
    borderRadius: 18,
    marginBottom: 4,
  },
  logo: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sub: { color: colors.textMuted, fontSize: 14 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  warnText: { color: colors.gold, flex: 1, fontSize: 12, lineHeight: 18 },
  form: { gap: spacing.md },
  formError: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  primary: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  disabled: { opacity: 0.7 },
  primaryText: { color: colors.black, fontWeight: '900', fontSize: 15 },
  linkMuted: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  switchText: { color: colors.textMuted },
  switchLink: { color: colors.text, fontWeight: '800' },
});
