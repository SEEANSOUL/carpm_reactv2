import { AppState } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { averageSpeedKmh } from './driveFormat';
import { DRIVE_LOCATION_TASK } from './driveTaskName';

export type DriveStatus = 'idle' | 'tracking' | 'paused';

export type DriveTrackPoint = {
  latitude: number;
  longitude: number;
  recordedAt: number;
  speedKmh: number;
};

export type DriveVehicle = {
  id: string;
  label: string;
  imageUrl: string | null;
  lPer100km: number;
  priceTry: number;
};

export type DriveSessionResult = {
  startedAt: string;
  endedAt: string;
  totalDistanceKm: number;
  maxSpeedKmh: number;
  averageSpeedKmh: number;
  durationSeconds: number;
  route: DriveTrackPoint[];
  vehicle: DriveVehicle | null;
};

export type DriveSnapshot = {
  status: DriveStatus;
  routePoints: DriveTrackPoint[];
  currentSpeedKmh: number;
  maxSpeedKmh: number;
  averageSpeedKmh: number;
  totalDistanceKm: number;
  elapsedSeconds: number;
  lastPoint: DriveTrackPoint | null;
  hasPendingSave: boolean;
};

const MIN_ACCURACY_METERS = 45;
const MIN_SEGMENT_METERS = 4;
const MAX_SEGMENT_METERS = 250;
const MAX_SPEED_KMH = 320;

function idleSnapshot(): DriveSnapshot {
  return {
    status: 'idle',
    routePoints: [],
    currentSpeedKmh: 0,
    maxSpeedKmh: 0,
    averageSpeedKmh: 0,
    totalDistanceKm: 0,
    elapsedSeconds: 0,
    lastPoint: null,
    hasPendingSave: false,
  };
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

class DriveTracker {
  private snapshot: DriveSnapshot = idleSnapshot();
  private listeners = new Set<() => void>();
  private watch: Location.LocationSubscription | null = null;
  private usingTask = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt: number | null = null;
  private pauseStartedAt: number | null = null;
  private pausedMs = 0;
  private pending: DriveSessionResult | null = null;
  private vehicle: DriveVehicle | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  getPendingSession() {
    return this.pending;
  }

  getVehicle() {
    return this.vehicle;
  }

  setVehicle(vehicle: DriveVehicle) {
    this.vehicle = vehicle;
  }

  clearVehicle() {
    this.vehicle = null;
  }

  private emit(next: DriveSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private elapsedSeconds(at = Date.now()) {
    if (this.startedAt == null) return 0;
    let paused = this.pausedMs;
    if (this.pauseStartedAt != null) paused += at - this.pauseStartedAt;
    return Math.max(0, Math.floor((at - this.startedAt - paused) / 1000));
  }

  async start() {
    if (this.snapshot.status !== 'idle') return;

    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      throw new Error('Konum servisleri kapalı. Ayarlardan konumu aç.');
    }

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      throw new Error('Sürüş takibi için konum izni gerekli.');
    }

    const now = Date.now();
    this.startedAt = now;
    this.pauseStartedAt = null;
    this.pausedMs = 0;
    this.pending = null;

    this.emit({ ...idleSnapshot(), status: 'tracking' });

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      this.ingest(current);
      await this.beginUpdates();
      this.startTimer();
    } catch (error) {
      void this.stopUpdates();
      this.stopTimer();
      this.startedAt = null;
      this.pauseStartedAt = null;
      this.pausedMs = 0;
      this.emit(idleSnapshot());
      throw error instanceof Error ? error : new Error('Konum takibi başlatılamadı.');
    }
  }

  async pause() {
    if (this.snapshot.status !== 'tracking') return;
    await this.stopUpdates();
    this.stopTimer();
    this.pauseStartedAt = Date.now();
    this.emit({
      ...this.snapshot,
      status: 'paused',
      currentSpeedKmh: 0,
      elapsedSeconds: this.elapsedSeconds(),
      averageSpeedKmh: averageSpeedKmh(
        this.snapshot.totalDistanceKm,
        this.elapsedSeconds(),
      ),
    });
  }

  async resume() {
    if (this.snapshot.status !== 'paused') return;
    if (this.pauseStartedAt != null) {
      this.pausedMs += Date.now() - this.pauseStartedAt;
      this.pauseStartedAt = null;
    }
    this.emit({ ...this.snapshot, status: 'tracking' });
    try {
      await this.beginUpdates();
      this.startTimer();
    } catch (error) {
      this.pauseStartedAt = Date.now();
      this.emit({ ...this.snapshot, status: 'paused', currentSpeedKmh: 0 });
      throw error instanceof Error ? error : new Error('Konum takibi sürdürülemedi.');
    }
  }

  finish(): DriveSessionResult | null {
    if (this.snapshot.status === 'idle' || this.startedAt == null) return null;

    void this.stopUpdates();
    this.stopTimer();

    const endedAt = Date.now();
    const durationSeconds = this.elapsedSeconds(endedAt);
    const result: DriveSessionResult = {
      startedAt: new Date(this.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      totalDistanceKm: this.snapshot.totalDistanceKm,
      maxSpeedKmh: this.snapshot.maxSpeedKmh,
      averageSpeedKmh: averageSpeedKmh(this.snapshot.totalDistanceKm, durationSeconds),
      durationSeconds,
      route: this.snapshot.routePoints.slice(),
      vehicle: this.vehicle ? { ...this.vehicle } : null,
    };

    this.pending = result;
    this.startedAt = null;
    this.pauseStartedAt = null;
    this.pausedMs = 0;
    this.emit({ ...idleSnapshot(), hasPendingSave: true });
    return result;
  }

  clearPending() {
    this.pending = null;
    if (this.snapshot.hasPendingSave) {
      this.emit({ ...this.snapshot, hasPendingSave: false });
    }
  }

  reset() {
    void this.stopUpdates();
    this.stopTimer();
    this.startedAt = null;
    this.pauseStartedAt = null;
    this.pausedMs = 0;
    this.pending = null;
    this.vehicle = null;
    this.emit(idleSnapshot());
  }

  ingest = (location: Location.LocationObject) => {
    if (this.snapshot.status !== 'tracking') return;
    if (AppState.currentState !== 'active' && !this.usingTask) return;

    const accuracy = location.coords.accuracy;
    const firstPoint = this.snapshot.routePoints.length === 0;
    if (!firstPoint && accuracy != null && accuracy > MIN_ACCURACY_METERS) return;

    const speedRaw = location.coords.speed;
    let currentSpeed =
      speedRaw == null || Number.isNaN(speedRaw) || speedRaw < 0 ? 0 : speedRaw * 3.6;

    const point: DriveTrackPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      recordedAt: location.timestamp,
      speedKmh: currentSpeed,
    };

    const points = this.snapshot.routePoints.slice();
    let distanceKm = this.snapshot.totalDistanceKm;
    let maxSpeed = this.snapshot.maxSpeedKmh;
    let accepted = false;

    if (points.length > 0) {
      const last = points[points.length - 1];
      const segment = distanceMeters(last, point);
      if (segment < MIN_SEGMENT_METERS) {
        currentSpeed = this.snapshot.currentSpeedKmh;
      } else if (segment <= MAX_SEGMENT_METERS) {
        distanceKm += segment / 1000;
        if (currentSpeed <= 0) {
          const dt = (point.recordedAt - last.recordedAt) / 1000;
          if (dt > 0) currentSpeed = (segment / dt) * 3.6;
        }
        point.speedKmh = currentSpeed;
        points.push(point);
        accepted = true;
      } else {
        currentSpeed = this.snapshot.currentSpeedKmh;
      }
    } else {
      points.push(point);
      accepted = true;
    }

    if (currentSpeed > MAX_SPEED_KMH) currentSpeed = 0;
    if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;

    const elapsedSeconds = this.elapsedSeconds();
    this.emit({
      ...this.snapshot,
      routePoints: points,
      currentSpeedKmh: currentSpeed,
      maxSpeedKmh: maxSpeed,
      averageSpeedKmh: averageSpeedKmh(distanceKm, elapsedSeconds),
      totalDistanceKm: distanceKm,
      elapsedSeconds,
      lastPoint: accepted ? point : this.snapshot.lastPoint,
    });
  };

  private async beginUpdates() {
    await this.stopUpdates();

    const expoGo = Constants.executionEnvironment === 'storeClient';
    let backgroundGranted = false;
    if (!expoGo) {
      try {
        const background = await Location.requestBackgroundPermissionsAsync();
        backgroundGranted = background.status === 'granted';
      } catch {
        backgroundGranted = false;
      }
    }

    if (backgroundGranted) {
      try {
        const running = await Location.hasStartedLocationUpdatesAsync(DRIVE_LOCATION_TASK);
        if (!running) {
          await Location.startLocationUpdatesAsync(DRIVE_LOCATION_TASK, {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 4,
            activityType: Location.ActivityType.AutomotiveNavigation,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'CaRPM Sürüş Takibi',
              notificationBody: 'Rota yalnızca cihazda tutuluyor',
              notificationColor: '#E10600',
            },
          });
        }
        this.usingTask = true;
        return;
      } catch {
        this.usingTask = false;
      }
    }

    this.watch = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      this.ingest,
    );
    this.usingTask = false;
  }

  private async stopUpdates() {
    if (this.watch) {
      this.watch.remove();
      this.watch = null;
    }
    if (this.usingTask) {
      try {
        const running = await Location.hasStartedLocationUpdatesAsync(DRIVE_LOCATION_TASK);
        if (running) await Location.stopLocationUpdatesAsync(DRIVE_LOCATION_TASK);
      } catch {
        /* görev zaten kapalı */
      }
      this.usingTask = false;
    }
  }

  private startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.snapshot.status !== 'tracking') return;
      const elapsedSeconds = this.elapsedSeconds();
      this.emit({
        ...this.snapshot,
        elapsedSeconds,
        averageSpeedKmh: averageSpeedKmh(this.snapshot.totalDistanceKm, elapsedSeconds),
      });
    }, 1000);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const driveTracker = new DriveTracker();
