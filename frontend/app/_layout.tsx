import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../src/auth";
import { routeForNotification } from "../src/notifications";

// Keep the QuickGig splash visible for an extra moment so the brand registers
// instead of flashing past. We hide it ~1.5s after the JS bundle is ready.
SplashScreen.preventAutoHideAsync().catch(() => {});
// Optional: set a fade-out animation when we finally hide the splash
try {
  SplashScreen.setOptions({ duration: 600, fade: true });
} catch {}

function NotificationRouter() {
  const handledIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Skip entirely on web — expo-notifications listeners are no-ops on web
    // and have caused module-load issues with the static web bundle.
    if (Platform.OS === "web") return;

    let sub: any = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((resp) => {
        try {
          const data = resp?.notification?.request?.content?.data;
          const path = routeForNotification(data);
          if (path) router.push(path as any);
        } catch {}
      });
    } catch {}

    // If the app was launched from a killed state by tapping a push, route on mount
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const id = last?.notification?.request?.identifier;
        if (last && id && !handledIds.current.has(id)) {
          handledIds.current.add(id);
          const data = last?.notification?.request?.content?.data;
          const path = routeForNotification(data);
          if (path) setTimeout(() => router.push(path as any), 500);
        }
      } catch {}
    })();

    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, []);
  return null;
}

export default function RootLayout() {
  // Hold the QuickGig splash a bit longer (~1.5s) so the brand actually
  // registers — Expo would otherwise hide it the instant the JS bundle
  // is ready, often well under 100ms on warm starts.
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <NotificationRouter />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FDFBF7" } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />

            <Stack.Screen name="job/[id]" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="review/[jobId]" />
            <Stack.Screen name="profile/[id]" />
            <Stack.Screen name="admin" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
