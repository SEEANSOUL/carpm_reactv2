import Constants from 'expo-constants';
import * as Location from 'expo-location';
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { driveTracker } from './driveTracker';
import { DRIVE_LOCATION_TASK } from './driveTaskName';

if (Constants.executionEnvironment === 'storeClient') {
  void Location.hasStartedLocationUpdatesAsync(DRIVE_LOCATION_TASK)
    .then((running) => {
      if (running) return Location.stopLocationUpdatesAsync(DRIVE_LOCATION_TASK);
    })
    .catch(() => undefined);
}

if (!TaskManager.isTaskDefined(DRIVE_LOCATION_TASK)) {
  TaskManager.defineTask(DRIVE_LOCATION_TASK, ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: LocationObject[] } | undefined)?.locations;
    if (!locations?.length) return;
    for (const location of locations) {
      driveTracker.ingest(location);
    }
  });
}
