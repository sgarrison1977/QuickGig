import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "./api";

// Show banner + play sound when a push arrives while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * Ask for permission, obtain the Expo push token, and register it with the backend.
 * Safe to call multiple times; a no-op on the web or simulators where push isn't available.
 * Returns the Expo push token, or null if unavailable.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Push notifications don't work on web, and Expo Push needs a physical device
    if (Platform.OS === "web") return null;
    if (!Device.isDevice) return null;

    // Android: set up the default channel (required for heads-up notifications)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "QuickGig",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B6B",
        sound: "default",
      });
    }

    // Ask for permission if we don't already have it
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    // Get the Expo push token (requires projectId in SDK 49+)
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      (Constants?.expoConfig as any)?.projectId;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp?.data || null;
    if (!token) return null;

    // Only re-register if it changed
    if (token !== registeredToken) {
      try {
        await api("/notifications/register-token", {
          method: "POST",
          body: { token, platform: Platform.OS },
        });
        registeredToken = token;
      } catch (e) {
        // Not fatal — user just won't get pushes this session
        console.log("[notif] register failed:", e);
      }
    }
    return token;
  } catch (e) {
    console.log("[notif] setup error:", e);
    return null;
  }
}

export async function unregisterPushToken() {
  try {
    if (registeredToken) {
      await api("/notifications/unregister-token", { method: "POST" });
    }
  } catch {}
  registeredToken = null;
}

export async function getNotifSettings(): Promise<{ enabled: boolean; has_token: boolean }> {
  try {
    return await api("/notifications/settings");
  } catch {
    return { enabled: true, has_token: false };
  }
}

export async function setNotifEnabled(enabled: boolean) {
  return api("/notifications/settings", { method: "PUT", body: { enabled } });
}

/** Build a deep-link path from a push notification payload. */
export function routeForNotification(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  const type = data.type;
  if (type === "message" && data.conversation_id) return `/chat/${data.conversation_id}`;
  if (type === "job_accepted" && data.conversation_id) return `/chat/${data.conversation_id}`;
  if (type === "job_accepted" && data.job_id) return `/job/${data.job_id}`;
  if (type === "job_completed" && data.job_id) return `/job/${data.job_id}`;
  if (type === "job_cancelled" && data.job_id) return `/job/${data.job_id}`;
  if (type === "review" && data.user_id) return `/profile/${data.user_id}`;
  return null;
}
