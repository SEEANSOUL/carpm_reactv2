import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUnreadNotificationCount } from '../api/carpm';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { UserAvatar } from './UserAvatar';
import { colors, spacing } from '../theme/colors';

const APP_LOGO = require('../../assets/icon.png');

type Props = {
  title?: string;
  brand?: string;
  showSearch?: boolean;
  onBellPress?: () => void;
  style?: ViewStyle;
};

export function AppHeader({
  title,
  brand = 'CaRPM',
  onBellPress,
  style,
}: Props) {
  const navigation = useAppNavigation();
  const { profile, user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnread(0);
      return;
    }
    try {
      setUnread(await fetchUnreadNotificationCount(user.id));
    } catch {
      /* sessiz */
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
    }, [refreshUnread]),
  );

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  function openBell() {
    if (onBellPress) {
      onBellPress();
      return;
    }
    navigation.navigate('Notifications');
  }

  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Image source={APP_LOGO} style={styles.logo} />
        <Text style={styles.brand}>
          {brand}
          {title ? <Text style={styles.title}> / {title}</Text> : null}
        </Text>
      </View>
      <View style={styles.right}>
        <Pressable
          onPress={() => navigation.navigate('Arena')}
          hitSlop={10}
          style={styles.bellWrap}
        >
          <Ionicons name="flame-outline" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={openBell} hitSlop={10} style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}>
          <UserAvatar
            uri={profile?.avatar_url}
            name={profile?.full_name || profile?.username}
            size={30}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brand: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 15,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrap: { position: 'relative' },
  dot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
