import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import type {Journey} from './types';

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('safety-reminders', {
      name: 'Safety reminders', importance: Notifications.AndroidImportance.HIGH,
      description: 'Private journey check-in reminders on this device.', vibrationPattern: [0, 250, 200, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelJourneyNotifications(journeyId?: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of all) {
    const data = notification.content.data;
    if (data?.saheliJourney && (!journeyId || data.journeyId === journeyId)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

export async function scheduleJourneyReminders(journey: Journey): Promise<boolean> {
  try {
    if (!(await ensureNotificationPermission())) return false;
    await cancelJourneyNotifications();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Saheli check-in due',
        body: `Check in for “${journey.destination}”. A missed check-in is a possible warning, not proof of an emergency.`,
        data: {saheliJourney: true, journeyId: journey.id, kind: 'reminder'},
      },
      trigger: {type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(journey.nextCheck)},
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Saheli journey grace period',
        body: 'If you have not checked in, please open Saheli. No trusted contact will be alerted automatically.',
        data: {saheliJourney: true, journeyId: journey.id, kind: 'grace'},
      },
      trigger: {type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(journey.nextCheck + journey.grace * 60_000)},
    });
    return true;
  } catch {
    // OS notification permissions/scheduling are best-effort; the persisted journey stays local.
    try { await cancelJourneyNotifications(journey.id); } catch { /* best effort cleanup */ }
    return false;
  }
}
