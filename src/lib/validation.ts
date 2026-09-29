const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Record<string, string>;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export function validateLogin(input: {
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const email = input.email.trim();

  if (!email) errors.email = 'E-posta gerekli';
  else if (!EMAIL_RE.test(email)) errors.email = 'Geçerli bir e-posta gir';

  if (!input.password) errors.password = 'Şifre gerekli';
  else if (input.password.length < 6) errors.password = 'Şifre en az 6 karakter';

  return errors;
}

export function validateRegister(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FieldErrors {
  const errors = validateLogin({
    email: input.email,
    password: input.password,
  });

  const fullName = input.fullName.trim();
  const username = normalizeUsername(input.username);

  if (!fullName) errors.fullName = 'Ad soyad gerekli';
  else if (fullName.length < 2) errors.fullName = 'Ad soyad çok kısa';
  else if (fullName.length > 60) errors.fullName = 'Ad soyad çok uzun';

  if (!username) errors.username = 'Kullanıcı adı gerekli';
  else if (!USERNAME_RE.test(username)) {
    errors.username = '3–30 karakter: küçük harf, rakam, alt çizgi';
  }

  if (!input.confirmPassword) errors.confirmPassword = 'Şifreyi tekrar gir';
  else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Şifreler eşleşmiyor';
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
