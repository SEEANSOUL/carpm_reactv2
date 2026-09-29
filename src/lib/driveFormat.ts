export function formatSpeedKmh(value: number) {
  return String(Math.round(value));
}

export function formatDistanceKm(value: number) {
  if (value < 1) return value.toFixed(2);
  return value.toFixed(1);
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function formatDurationStory(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0 && minutes > 0) return `${hours}s ${minutes}dk`;
  if (hours > 0) return `${hours}s`;
  if (minutes > 0 && secs > 0) return `${minutes}dk ${secs}sn`;
  if (minutes > 0) return `${minutes}dk`;
  return `${secs}sn`;
}

export function formatDurationCompact(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}sa ${minutes}dk`;
  if (minutes > 0) return `${minutes}dk`;
  return `${seconds}sn`;
}

export function formatDriveDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fuelLiters(distanceKm: number, litersPer100km: number) {
  if (distanceKm <= 0 || litersPer100km <= 0) return 0;
  return (distanceKm * litersPer100km) / 100;
}

export function fuelCostTry(liters: number, pricePerLiter: number) {
  if (liters <= 0 || pricePerLiter <= 0) return 0;
  return liters * pricePerLiter;
}

export function formatLiters(value: number) {
  if (value < 10) return value.toFixed(2);
  return value.toFixed(1);
}

export function formatTry(value: number) {
  return Math.round(value).toLocaleString('tr-TR');
}

export function averageSpeedKmh(distanceKm: number, durationSeconds: number) {
  const hours = durationSeconds / 3600;
  if (hours <= 0 || distanceKm <= 0) return 0;
  return distanceKm / hours;
}
