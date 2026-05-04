import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function showIndexingNotification(
  current: number,
  total: number,
): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });

  await Notifications.scheduleNotificationAsync({
    identifier: "indexing-progress",
    content: {
      title: "Photo Search",
      body: `Indexing ${current} / ${total} photos`,
      data: { current, total },
      ...(Platform.OS === "android" && {
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
      }),
    },
    trigger: null,
  });
}

export async function dismissIndexingNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync("indexing-progress");
}
