import React, { useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DriveStoryCard, type DriveStoryCardHandle } from '../components/DriveStoryCard';
import { useAuth } from '../context/AuthContext';
import { formatDistanceKm, formatDurationStory, formatSpeedKmh } from '../lib/driveFormat';
import { publishDriveStoryImage } from '../lib/shareDriveStory';
import type { DriveLog } from '../types/models';

type Props = NativeStackScreenProps<{ DriveLogDetail: { log: DriveLog } }, 'DriveLogDetail'>;

export function DriveLogDetailScreen({ navigation, route }: Props) {
  const log = route.params.log;
  const { profile, user } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const storyCard = useRef<DriveStoryCardHandle>(null);
  const name = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'Pilot';

  async function onShare() {
    if (!user || !log.vehicle_image_url || shared || !storyCard.current) return;
    setSharing(true);
    setNotice(null);
    try {
      const imageUri = await storyCard.current.captureImage();
      const caption = [
        log.vehicle_label,
        `${formatDistanceKm(log.total_distance_km)} km`,
        formatDurationStory(log.duration_seconds),
        `maks ${formatSpeedKmh(log.max_speed_kmh)} km/h`,
      ]
        .filter(Boolean)
        .join(' · ');
      await publishDriveStoryImage({
        userId: user.id,
        imageUri,
        caption,
        vehicleId: log.vehicle_id,
      });
      setShared(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Paylaşılamadı.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <DriveStoryCard
      ref={storyCard}
      name={name}
      avatarUrl={profile?.avatar_url}
      distanceKm={log.total_distance_km}
      durationSeconds={log.duration_seconds}
      maxSpeedKmh={log.max_speed_kmh}
      route={log.route}
      vehicleLabel={log.vehicle_label}
      vehicleImageUrl={log.vehicle_image_url}
      fuelLiters={log.fuel_liters}
      fuelCostTry={log.fuel_cost_try}
      fuelLPer100={log.fuel_l_per_100km}
      notice={notice}
      onShare={() => void onShare()}
      sharing={sharing}
      shared={shared}
      onClose={() => navigation.goBack()}
    />
  );
}
