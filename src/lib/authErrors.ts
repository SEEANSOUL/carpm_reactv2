/** Supabase / Auth / Storage hatalarını Türkçe ve okunabilir hale getirir */

function extractMessage(error: unknown): string {
  if (!error) return 'Bilinmeyen bir hata oluştu';
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
    if (typeof e.error_description === 'string') return e.error_description;
    if (typeof e.details === 'string' && e.details.trim()) return e.details;
    if (typeof e.hint === 'string' && e.hint.trim()) return e.hint;
    try {
      return JSON.stringify(e);
    } catch {
      return 'Bilinmeyen bir hata oluştu';
    }
  }

  return 'Bilinmeyen bir hata oluştu';
}

export function mapAuthError(error: unknown): string {
  const raw = extractMessage(error);
  const msg = raw.toLowerCase();
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  if (msg.includes('supabase yapılandırılmamış')) return raw;
  if (msg.includes('invalid login credentials')) {
    return 'E-posta veya şifre hatalı.';
  }
  if (msg.includes('email not confirmed')) {
    return 'E-posta henüz doğrulanmamış. Gelen kutunu kontrol et.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.';
  }
  if (msg.includes('password should be at least')) {
    return 'Şifre en az 6 karakter olmalı.';
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return 'Geçerli bir e-posta adresi gir.';
  }
  if (
    code === '23505' ||
    (msg.includes('duplicate') && msg.includes('key')) ||
    msg.includes('unique constraint')
  ) {
    return 'Bu işlem zaten yapılmış.';
  }
  if (
    msg.includes('username') &&
    (msg.includes('taken') || msg.includes('duplicate') || msg.includes('unique'))
  ) {
    return 'Bu kullanıcı adı alınmış. Başka bir tane dene.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return 'İnternet bağlantısı yok veya sunucuya ulaşılamıyor.';
  }
  if (msg.includes('payload too large') || msg.includes('maximum allowed size')) {
    return 'Dosya çok büyük. Daha küçük bir fotoğraf dene (max 8 MB).';
  }
  if (msg.includes('mime type') || msg.includes('not allowed')) {
    return 'Bu dosya türü desteklenmiyor. JPG veya PNG kullan.';
  }
  if (
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('violates') ||
    msg.includes('permission denied')
  ) {
    return 'Yetki hatası. Çıkış yapıp tekrar giriş dene. (Gerekirse supabase/likes.sql çalıştır)';
  }
  if (msg.includes('bucket') && msg.includes('not found')) {
    return 'Storage bucket bulunamadı. supabase/storage.sql çalıştır.';
  }
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return 'Tablo eksik. supabase/schema.sql dosyasını çalıştır.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  }
  if (msg.includes('signup is disabled')) {
    return 'Yeni kayıt şu an kapalı. Daha sonra tekrar dene.';
  }
  if (msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('session')) {
    return 'Oturum süresi dolmuş olabilir. Çıkış yapıp tekrar giriş yap.';
  }

  return raw;
}

/** Supabase { error } nesnesini her zaman Error olarak fırlat */
export function throwIfError(error: unknown): asserts error is null {
  if (!error) return;
  throw new Error(mapAuthError(error));
}
