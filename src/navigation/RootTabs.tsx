import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShotsScreen } from '../screens/ShotsScreen';
import { ClubsScreen } from '../screens/ClubsScreen';
import { CreateShotScreen } from '../screens/CreateShotScreen';
import { GarageScreen } from '../screens/GarageScreen';
import { LiveDriveScreen } from '../screens/LiveDriveScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useExitConfirm } from '../hooks/useExitConfirm';
import { colors } from '../theme/colors';

export type RootTabParamList = {
  Shots: undefined;
  Clubs: undefined;
  Create: undefined;
  Garage: undefined;
  Drive: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function CenterTabButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.centerWrap}>
      <View style={styles.centerBtn}>
        <View style={styles.centerInner}>
          <Ionicons name="radio-button-on" size={28} color={colors.accent} />
        </View>
      </View>
    </Pressable>
  );
}

function TabIcon({
  name,
  label,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={name}
        size={20}
        color={focused ? colors.white : colors.textDim}
      />
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelActive]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

export function RootTabs() {
  const insets = useSafeAreaInsets();
  useExitConfirm();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: Math.max(insets.bottom, 10),
          height: 68,
          borderRadius: 22,
          backgroundColor: 'rgba(12,12,12,0.96)',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          paddingBottom: 0,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen
        name="Shots"
        component={ShotsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'flame' : 'flame-outline'} label="SHOTS" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Clubs"
        component={ClubsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'people' : 'people-outline'}
              label="KULÜPLER"
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateShotScreen}
        options={{
          tabBarStyle: { display: 'none' },
          tabBarButton: (props) => (
            <CenterTabButton onPress={props.onPress as () => void} />
          ),
        }}
      />
      <Tab.Screen
        name="Garage"
        component={GarageScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'construct' : 'construct-outline'}
              label="GARAJIM"
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Drive"
        component={LiveDriveScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'navigate' : 'navigate-outline'}
              label="SÜRÜŞ"
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'person' : 'person-outline'}
              label="PROFİL"
              focused={focused}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    top: 8,
    minWidth: 48,
  },
  tabLabel: {
    color: colors.textDim,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelActive: { color: colors.white },
  centerWrap: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.bg,
  },
  centerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
