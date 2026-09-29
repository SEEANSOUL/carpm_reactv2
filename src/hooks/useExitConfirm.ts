import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sweetAlert } from '../components/SweetAlert';

/** Android geri tuşu: uygulamadan çıkmadan önce onay sorar */
export function useExitConfirm() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;

      const onBack = () => {
        sweetAlert('Çıkış', 'Uygulamadan çıkmak istiyor musun?', [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Çık',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ]);
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );
}
