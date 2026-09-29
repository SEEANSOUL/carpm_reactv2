import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const SUPABASE_URL = String(
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '',
).trim();

export const SUPABASE_ANON_KEY = String(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '',
).trim();

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.includes('YOUR_') &&
  !SUPABASE_ANON_KEY.includes('YOUR_');

/**
 * Session JWT AsyncStorage'da tutulur (SecureStore 2KB limiti JWT için yetmez).
 * Client her zaman oluşturulur; yapılandırma yoksa auth çağrıları net hata verir.
 */
function createSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export const supabase = createSupabaseClient();

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase yapılandırılmamış. Proje köküne .env ekle:\nEXPO_PUBLIC_SUPABASE_URL=...\nEXPO_PUBLIC_SUPABASE_ANON_KEY=...',
    );
  }
  return supabase;
}
