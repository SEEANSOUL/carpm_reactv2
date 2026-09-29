import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { requireSupabase } from './supabase';

export type PushRegisterResult = {
  ok: boolean;
  token?: string;
  error?: string;
};

const ANDROID_CHANNEL = 'carpm_default';

/** Expo Go (SDK 53+) Android'de remote push yok — development/preview APK gerekir. */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function getProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    '8a2801b7-0d51-413d-895b-c299d9e989fa'
  );
}

export async function registerAndSavePushToken(): Promise<PushRegisterResult> {
  if (isExpoGo()) {
    return {
      ok: false,
      error:
        'Expo Go’da Android push yok. CaRPM APK’sını kur (EAS preview / development build).',
    };
  }

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'CaRPM',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E11D48',
        showBadge: true,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      return {
        ok: false,
        error:
          'Bildirim izni kapalı. Ayarlar → Uygulamalar → CaRPM → Bildirimler aç.',
      };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return { ok: false, error: 'EAS projectId bulunamadı' };
    }

    let token: string;
    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenResult.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Push token alınamadı: ${msg}`,
      };
    }

    if (!token) {
      return { ok: false, error: 'Boş push token' };
    }

    const client = requireSupabase();
    const { error } = await client.rpc('upsert_push_token', {
      p_token: token,
      p_platform: Platform.OS,
    });

    if (error) {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        return { ok: false, error: error.message };
      }
      const fallback = await client.from('push_tokens').upsert(
        { user_id: userId, token, platform: Platform.OS },
        { onConflict: 'token' },
      );
      if (fallback.error) {
        return { ok: false, error: fallback.error.message };
      }
    }

    return { ok: true, token };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function removePushTokenLocal(): Promise<void> {
  if (isExpoGo()) return;
  try {
    const Notifications = await import('expo-notifications');
    const projectId = getProjectId();
    if (!projectId) return;
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult.data;
    if (!token) return;
    const client = requireSupabase();
    await client.from('push_tokens').delete().eq('token', token);
  } catch {
    // çıkışta sessiz
  }
}

export function subscribeAppStateForPush(onActive: () => void) {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') onActive();
  });
  return () => sub.remove();
}

export function isPhysicalDeviceHint() {
  return Device.isDevice;
}
