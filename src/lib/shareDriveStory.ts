import { deleteAsync } from 'expo-file-system/legacy';
import { publishShot } from '../api/carpm';
import { uploadImage } from './storage';

export async function publishDriveStoryImage(params: {
  userId: string;
  imageUri: string;
  caption: string;
  vehicleId?: string | null;
}) {
  try {
    const url = await uploadImage({
      bucket: 'shots',
      userId: params.userId,
      prefix: 'drive',
      image: {
        uri: params.imageUri,
        mimeType: 'image/jpeg',
        ext: 'jpg',
      },
    });
    await publishShot({
      creator_id: params.userId,
      vehicle_id: params.vehicleId,
      caption: params.caption,
      hashtags: ['#sürüş'],
      video_url: url,
      thumbnail_url: url,
      destination: 'explore',
    });
  } finally {
    await deleteAsync(params.imageUri, { idempotent: true }).catch(() => undefined);
  }
}
