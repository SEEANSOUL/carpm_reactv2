import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Vehicle } from '../types/models';
import { RootTabs, type RootTabParamList } from './RootTabs';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { EditVehicleScreen } from '../screens/EditVehicleScreen';
import { CreateClubScreen } from '../screens/CreateClubScreen';
import { CreateEventScreen } from '../screens/CreateEventScreen';
import { CommentsScreen } from '../screens/CommentsScreen';
import { ClubDetailScreen } from '../screens/ClubDetailScreen';
import { CreateClubPostScreen } from '../screens/CreateClubPostScreen';
import { ClubPostDetailScreen } from '../screens/ClubPostDetailScreen';
import { UserGarageScreen } from '../screens/UserGarageScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ArenaScreen } from '../screens/ArenaScreen';
import { ArenaLeaderboardScreen } from '../screens/ArenaLeaderboardScreen';
import { DriveHistoryScreen } from '../screens/DriveHistoryScreen';
import { DriveLogDetailScreen } from '../screens/DriveLogDetailScreen';
import type { DriveLog } from '../types/models';
import { colors } from '../theme/colors';

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  EditProfile: undefined;
  EditVehicle: { vehicle?: Vehicle } | undefined;
  CreateClub: undefined;
  CreateEvent: { clubId: string; eventId?: string };
  Comments: { shotId: string };
  ClubDetail: { clubId: string };
  CreateClubPost: { clubId: string; postId?: string };
  ClubPostDetail: { clubId: string; postId: string };
  UserGarage: { userId: string };
  Notifications: undefined;
  Arena: undefined;
  ArenaLeaderboard: undefined;
  DriveHistory: undefined;
  DriveLogDetail: { log: DriveLog };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        presentation: 'modal',
      }}
    >
      <Stack.Screen name="Tabs" component={RootTabs} options={{ presentation: 'card' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
      <Stack.Screen name="CreateClub" component={CreateClubScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} />
      <Stack.Screen
        name="ClubDetail"
        component={ClubDetailScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen name="CreateClubPost" component={CreateClubPostScreen} />
      <Stack.Screen
        name="ClubPostDetail"
        component={ClubPostDetailScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="UserGarage"
        component={UserGarageScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="Arena"
        component={ArenaScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="ArenaLeaderboard"
        component={ArenaLeaderboardScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="DriveHistory"
        component={DriveHistoryScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="DriveLogDetail"
        component={DriveLogDetailScreen}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}
