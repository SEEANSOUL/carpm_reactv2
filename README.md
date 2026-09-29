# CARPM

React Native (Expo) + Supabase — otomobil & motosiklet topluluk uygulaması.

## Ekranlar

- **Shots** — kısa video akışı (telemetri HUD, beğeni/yorum, araç kartı)
- **Kulüpler** — öne çıkan kulüp, canlı buluşma, pist günü geri sayımı
- **Paylaş** — shot oluşturma (araç, telemetri, kulüp hedefi, audio)
- **Garajım** — araç vitrini
- **Profil** — rozetler, garaj, shots grid

## Kurulum

```bash
npm install
cp .env.example .env
# .env içine Supabase URL + anon key yaz
npx expo start -c
```

## Auth (Login / Register)

Uygulama açılışta oturum yoksa **Giriş / Kayıt** ekranına düşer.

### CRUD (Supabase)

| Alan | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| Profil | kayıt | profil | Profili Düzenle | — |
| Araç | Garaj / Araç Ekle | Garaj, Profil | dokun | uzun bas / düzenle |
| Shot | orta buton | feed | — | ⋯ menü / uzun bas |
| Like / Bookmark / Yorum | feed ikonları | yorum ekranı | — | kendi yorumun |
| Kulüp | Kulüpler → Kulüp | liste | — | İşlem → sil |
| Etkinlik | Etkinlik butonu | kulüpler | — | çöp ikonu |
| Üyelik / RSVP | Katıl / Katılıyorum | — | — | Ayrıl / İptal |

SQL yamaları:
1. `supabase/schema.sql` (ilk kurulum)
2. `supabase/auth.sql` (opsiyonel)
3. `supabase/crud.sql` ← kulüp/etkinlik silme + sayaçlar
4. `supabase/storage.sql` ← **fotoğraf bucket’ları (zorunlu)**
5. `supabase/club_forum.sql` ← **kulüp içi üyelere özel forum**
6. `supabase/notifications.sql` ← **beğeni / takip / kulüp katılım bildirimleri**
7. `supabase/club_membership_approval.sql` ← **kulüp katılım onayı (kurucu)**
8. `supabase/push_notifications.sql` ← **uygulama dışı Expo push (zorunlu)**
9. `supabase/admin.sql` ← admin panel (opsiyonel)

### Push bildirimleri (uygulama dışı)

Beğeni / takip / kulüp / admin broadcast → `notifications` insert → `pg_net` ile Expo Push.

1. SQL Editor’de `supabase/push_notifications.sql` çalıştır
2. Android: Expo dashboard → project → credentials → **FCM V1** yükle
3. Yeni APK al (`eas build`) — Expo Go’da Android push yok
4. Giriş yap → bildirim izni ver → token `push_tokens` tablosuna yazılır

### Fotoğraf yükleme (Storage)

Uygulama URL yazdırmaz; galeri/kamera ile yükler:
- Profil → `avatars`
- Araç → `vehicles`
- Kulüp → `club-banners`
- Shot → `shots`
- Kulüp forumu → `club-forum`

Dosya yolu: `{userId}/...` (RLS ile korunur, max 8 MB)

1. SQL Editor’de sırayla:
   - `supabase/schema.sql` (ilk kurulum)
   - veya sadece auth güncellemesi: `supabase/auth.sql`
2. Dashboard → **Authentication → Providers → Email** açık olsun
3. Geliştirmede hızlı test için **Confirm email** kapat
4. Profil’deki kırmızı çıkış ikonu ile `signOut`

Kayıt sırasında:
- username müsaitlik kontrolü (`is_username_available`)
- `auth.users` insert → trigger ile `profiles` satırı
- istemci `ensureProfile` ile eksik profili tamamlar

## Klasör yapısı

```
src/
  api/          # Tam CRUD API
  components/
  context/      # AuthProvider / useAuth
  data/         # (kaldırıldı — mock yok)
  hooks/
  lib/
  navigation/   # AuthStack + AppStack + Tabs
  screens/
    auth/
  theme/
  types/
supabase/
  schema.sql
  auth.sql
  crud.sql
  seed.sql      # sadece categories (opsiyonel)
```
