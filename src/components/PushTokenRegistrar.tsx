import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  isExpoGo,
  registerAndSavePushToken,
  subscribeAppStateForPush,
} from '../lib/pushNotifications';

/** Oturum açılınca / uygulama öne gelince Expo push token kaydeder. */
export function PushTokenRegistrar() {
  const { session } = useAuth();
  const busy = useRef(false);

  useEffect(() => {
    if (!session?.user) return;
    if (isExpoGo()) {
      console.warn('Push: Expo Go’da atlandı — APK kullan');
      return;
    }

    async function run() {
      if (busy.current) return;
      busy.current = true;
      try {
        const result = await registerAndSavePushToken();
        if (!result.ok) {
          console.warn('Push kayıt:', result.error);
        } else {
          console.log('Push token OK');
        }
      } catch (e) {
        console.warn('Push kayıt hatası:', e);
      } finally {
        busy.current = false;
      }
    }

    void run();
    const t1 = setTimeout(() => void run(), 2500);
    const t2 = setTimeout(() => void run(), 8000);
    const unsub = subscribeAppStateForPush(() => void run());

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      unsub();
    };
  }, [session?.user?.id]);

  return null;
}
