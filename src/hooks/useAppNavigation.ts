import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppStack';

export function useAppNavigation() {
  return useNavigation<NativeStackNavigationProp<AppStackParamList>>();
}
