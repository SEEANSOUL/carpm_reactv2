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
import { mapAuthError } from '../../lib/authErrors';
import {
  hasErrors,
  normalizeUsername,
  validateRegister,
} from '../../lib/validation';
import { colors, radii, spacing } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { signUp, configured } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const errors = validateRegister({
      fullName,
      username,
      email,
      password,
      confirmPassword,
    });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    if (!configured) {
      setFormError(
        'Supabase bağlı değil. .env dosyasına URL ve anon key ekleyip Expo’yu yeniden başlat.',
      );
      return;
    }

    setBusy(true);
    try {
      const result = await signUp({
        email,
        password,
        fullName,
        username,
      });

      if (result.needsEmailConfirm) {
        sweetAlert(
          'E-posta doğrulama',
          'Hesap oluşturuldu. Giriş yapmadan önce e-postandaki doğrulama linkine tıkla.\n\n(Geliştirme için Supabase → Authentication → Providers → Email → “Confirm email” kapatılabilir.)',
          [{ text: 'Girişe dön', onPress: () => navigation.navigate('Login') }],
        );
      }
    } catch (e) {
      setFormError(mapAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardForm contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Geri</Text>
        </Pressable>

        <View style={styles.brand}>
          <Image source={require('../../../assets/icon.png')} style={styles.appLogo} />
          <Text style={styles.logo}>CaRPM</Text>
          <Text style={styles.sub}>Yeni pilot hesabı oluştur</Text>
        </View>

        <View style={styles.form}>
          <AuthInput
            label="AD SOYAD"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Caner Demir"
            autoCapitalize="words"
            textContentType="name"
            error={fieldErrors.fullName}
          />
          <AuthInput
            label="KULLANICI ADI"
            value={username}
            onChangeText={(t) => setUsername(normalizeUsername(t))}
            placeholder="caner_m4"
            textContentType="username"
            autoComplete="username"
            error={fieldErrors.username}
          />
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
            placeholder="En az 6 karakter"
            isPassword
            textContentType="newPassword"
            autoComplete="password-new"
            error={fieldErrors.password}
          />
          <AuthInput
            label="ŞİFRE TEKRAR"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Şifreyi tekrar yaz"
            isPassword
            textContentType="newPassword"
            error={fieldErrors.confirmPassword}
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? (
              <CarpmLoader size="sm" tone="light" />
            ) : (
              <Text style={styles.primaryText}>Kayıt Ol</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={styles.switchRow}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.switchText}>Zaten hesabın var mı? </Text>
          <Text style={styles.switchLink}>Giriş Yap</Text>
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
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.text, fontWeight: '700' },
  brand: { alignItems: 'center', gap: 6, marginTop: spacing.sm },
  appLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 4,
  },
  logo: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sub: { color: colors.textMuted },
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
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  disabled: { opacity: 0.7 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  switchText: { color: colors.textMuted },
  switchLink: { color: colors.text, fontWeight: '800' },
});
