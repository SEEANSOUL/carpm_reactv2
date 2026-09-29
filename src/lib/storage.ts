import * as ImagePicker from 'expo-image-picker';
import {
  EncodingType,
  FileSystemUploadType,
  cacheDirectory,
  copyAsync,
  createUploadTask,
  getInfoAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { requireSupabase } from './supabase';
import { mapAuthError } from './authErrors';

export type MediaBucket =
  | 'avatars'
  | 'vehicles'
  | 'club-banners'
  | 'club-forum'
  | 'shots'
  | 'shot-thumbs';

export type UploadProgress = {
  phase: 'prepare' | 'upload' | 'done';
  percent?: number;
  message: string;
};

export type UploadProgressHandler = (progress: UploadProgress) => void;

export type PickedImage = {
  uri: string;
  mimeType: string;
  ext: string;
  width?: number;
  height?: number;
};

export type PickedVideo = {
  uri: string;
  mimeType: string;
  ext: string;
  durationMs?: number;
  width?: number;
  height?: number;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION_SEC = 60;
const MAX_BASE64_FALLBACK_BYTES = 12 * 1024 * 1024;

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic') || mime.includes('heif')) return 'heic';
  return 'jpg';
}

function extFromVideoMime(mime: string, uri: string): string {
  const lower = `${mime} ${uri}`.toLowerCase();
  if (lower.includes('quicktime') || lower.includes('.mov')) return 'mov';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('3gp')) return '3gp';
  return 'mp4';
}

function buildObjectPath(userId: string, ext: string, prefix?: string) {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const folder = prefix ? `${userId}/${prefix}` : userId;
  return `${folder}/${stamp}-${rand}.${ext}`;
}

/** content:// / ph:// → cache file:// */
async function toUploadableFileUri(uri: string, ext: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  if (!cacheDirectory) {
    throw new Error('Geçici klasör açılamadı. Uygulamayı yeniden başlat.');
  }
  const dest = `${cacheDirectory}carpm-upload-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}.${ext}`;
  try {
    await copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    throw new Error('Dosya kopyalanamadı. Galeriden tekrar seç.');
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function uploadBase64(params: {
  bucket: MediaBucket;
  path: string;
  uri: string;
  mimeType: string;
  onProgress?: UploadProgressHandler;
}): Promise<string> {
  const client = requireSupabase();
  params.onProgress?.({
    phase: 'prepare',
    percent: 5,
    message: 'Dosya hazırlanıyor…',
  });
  const base64 = await readAsStringAsync(params.uri, {
    encoding: EncodingType.Base64,
  });
  params.onProgress?.({
    phase: 'upload',
    percent: 35,
    message: 'Yükleniyor…',
  });
  const { error } = await client.storage.from(params.bucket).upload(params.path, decode(base64), {
    contentType: params.mimeType,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw new Error(mapAuthError(error));
  const { data } = client.storage.from(params.bucket).getPublicUrl(params.path);
  if (!data?.publicUrl) throw new Error('Yükleme tamamlandı ama URL alınamadı.');
  params.onProgress?.({
    phase: 'done',
    percent: 100,
    message: 'Tamamlandı',
  });
  return data.publicUrl;
}

async function uploadSignedBinary(params: {
  bucket: MediaBucket;
  path: string;
  fileUri: string;
  mimeType: string;
  onProgress?: UploadProgressHandler;
}): Promise<string> {
  const client = requireSupabase();
  params.onProgress?.({
    phase: 'prepare',
    percent: 5,
    message: 'Yükleme hazırlanıyor…',
  });
  const signed = await withTimeout(
    client.storage.from(params.bucket).createSignedUploadUrl(params.path),
    20000,
    'Yükleme zaman aşımı (imza). Tekrar dene.',
  );
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error ? mapAuthError(signed.error) : 'İmzalı URL alınamadı.');
  }

  params.onProgress?.({
    phase: 'upload',
    percent: 10,
    message: 'Video yükleniyor… (büyük dosya sürebilir)',
  });

  const task = createUploadTask(
    signed.data.signedUrl,
    params.fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': params.mimeType },
    },
    (event) => {
      const total = event.totalBytesExpectedToSend;
      const sent = event.totalBytesSent;
      if (total > 0) {
        const pct = Math.min(99, Math.max(10, Math.round((sent / total) * 100)));
        params.onProgress?.({
          phase: 'upload',
          percent: pct,
          message: `Yükleniyor… %${pct}`,
        });
      }
    },
  );

  const result = await withTimeout(
    task.uploadAsync().then((r) => {
      if (!r) throw new Error('Yükleme sonucu alınamadı.');
      return r;
    }),
    90000,
    'Yükleme zaman aşımı. Daha kısa video dene.',
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Yükleme başarısız (${result.status}).`);
  }

  const { data } = client.storage.from(params.bucket).getPublicUrl(params.path);
  if (!data?.publicUrl) throw new Error('Yükleme tamamlandı ama URL alınamadı.');
  params.onProgress?.({
    phase: 'done',
    percent: 100,
    message: 'Tamamlandı',
  });
  return data.publicUrl;
}

async function ensureLibraryPermission() {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return;
  const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!asked.granted) {
    throw new Error('Galeri izni gerekli. Ayarlardan fotoğraf erişimini aç.');
  }
}

async function ensureCameraPermission() {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return;
  const asked = await ImagePicker.requestCameraPermissionsAsync();
  if (!asked.granted) {
    throw new Error('Kamera izni gerekli. Ayarlardan kamera erişimini aç.');
  }
}

export async function pickFromLibrary(options?: {
  aspect?: [number, number];
  quality?: number;
}): Promise<PickedImage | null> {
  await ensureLibraryPermission();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.85,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'image/jpeg';
  return {
    uri: asset.uri,
    mimeType,
    ext: extFromMime(mimeType),
    width: asset.width,
    height: asset.height,
  };
}

export async function takePhoto(options?: {
  aspect?: [number, number];
  quality?: number;
}): Promise<PickedImage | null> {
  await ensureCameraPermission();
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.85,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'image/jpeg';
  return {
    uri: asset.uri,
    mimeType,
    ext: extFromMime(mimeType),
    width: asset.width,
    height: asset.height,
  };
}

export async function uploadImage(params: {
  bucket: MediaBucket;
  userId: string;
  image: PickedImage;
  prefix?: string;
  onProgress?: UploadProgressHandler;
}): Promise<string> {
  const { bucket, userId, image, prefix, onProgress } = params;
  const path = buildObjectPath(userId, image.ext, prefix);

  const info = await getInfoAsync(image.uri);
  if (info.exists && 'size' in info && info.size != null && info.size > MAX_IMAGE_BYTES) {
    throw new Error('Fotoğraf en fazla 8 MB olabilir.');
  }

  onProgress?.({
    phase: 'prepare',
    percent: 0,
    message: 'Fotoğraf hazırlanıyor…',
  });

  // Fotoğraflar: eski çalışan base64 yolu (signed upload cihazda takılıyordu)
  try {
    return await uploadBase64({
      bucket,
      path,
      uri: image.uri,
      mimeType: image.mimeType,
      onProgress,
    });
  } catch {
    const fileUri = await toUploadableFileUri(image.uri, image.ext);
    return uploadBase64({
      bucket,
      path: buildObjectPath(userId, image.ext, prefix),
      uri: fileUri,
      mimeType: image.mimeType,
      onProgress,
    });
  }
}

export async function pickVideoFromLibrary(): Promise<PickedVideo | null> {
  await ensureLibraryPermission();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: true,
    videoMaxDuration: MAX_VIDEO_DURATION_SEC,
    quality: 1,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'video/mp4';
  if (asset.duration != null && asset.duration > (MAX_VIDEO_DURATION_SEC + 1) * 1000) {
    throw new Error(`Video en fazla ${MAX_VIDEO_DURATION_SEC} saniye olabilir.`);
  }
  return {
    uri: asset.uri,
    mimeType,
    ext: extFromVideoMime(mimeType, asset.uri),
    durationMs: asset.duration ?? undefined,
    width: asset.width,
    height: asset.height,
  };
}

export async function recordVideo(): Promise<PickedVideo | null> {
  await ensureCameraPermission();
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    allowsEditing: true,
    videoMaxDuration: MAX_VIDEO_DURATION_SEC,
    quality: 1,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'video/mp4';
  return {
    uri: asset.uri,
    mimeType,
    ext: extFromVideoMime(mimeType, asset.uri),
    durationMs: asset.duration ?? undefined,
    width: asset.width,
    height: asset.height,
  };
}

export async function uploadVideo(params: {
  bucket: MediaBucket;
  userId: string;
  video: PickedVideo;
  prefix?: string;
  onProgress?: UploadProgressHandler;
}): Promise<string> {
  const { bucket, userId, video, prefix, onProgress } = params;
  const path = buildObjectPath(userId, video.ext, prefix);

  onProgress?.({
    phase: 'prepare',
    percent: 0,
    message: 'Video hazırlanıyor…',
  });
  const fileUri = await toUploadableFileUri(video.uri, video.ext);

  const info = await getInfoAsync(fileUri);
  if (!info.exists) throw new Error('Seçilen video bulunamadı.');
  const size = 'size' in info && info.size != null ? info.size : null;
  if (size != null && size > MAX_VIDEO_BYTES) {
    throw new Error('Video en fazla 50 MB olabilir.');
  }

  try {
    return await uploadSignedBinary({
      bucket,
      path,
      fileUri,
      mimeType: video.mimeType,
      onProgress,
    });
  } catch (signedErr) {
    if (size != null && size > MAX_BASE64_FALLBACK_BYTES) {
      throw signedErr instanceof Error
        ? signedErr
        : new Error('Video yüklenemedi. Daha kısa / küçük dosya dene.');
    }
    return uploadBase64({
      bucket,
      path,
      uri: fileUri,
      mimeType: video.mimeType,
      onProgress,
    });
  }
}

export async function pickAndUpload(params: {
  bucket: MediaBucket;
  userId: string;
  source: 'library' | 'camera';
  aspect?: [number, number];
  prefix?: string;
  onProgress?: UploadProgressHandler;
}): Promise<string | null> {
  const image =
    params.source === 'camera'
      ? await takePhoto({ aspect: params.aspect })
      : await pickFromLibrary({ aspect: params.aspect });
  if (!image) return null;
  return uploadImage({
    bucket: params.bucket,
    userId: params.userId,
    image,
    prefix: params.prefix,
    onProgress: params.onProgress,
  });
}

export async function pickAndUploadVideo(params: {
  bucket: MediaBucket;
  userId: string;
  source: 'library' | 'camera';
  prefix?: string;
  onProgress?: UploadProgressHandler;
}): Promise<string | null> {
  const video =
    params.source === 'camera' ? await recordVideo() : await pickVideoFromLibrary();
  if (!video) return null;
  return uploadVideo({
    bucket: params.bucket,
    userId: params.userId,
    video,
    prefix: params.prefix,
    onProgress: params.onProgress,
  });
}
