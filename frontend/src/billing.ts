import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

export type PackageId =
  | "pro_monthly"
  | "background_check"
  | "id_verification"
  | "boost_24h"
  | "boost_48h";

type CheckoutStatus = {
  session_id: string;
  status: string;
  payment_status: string;
  amount_total?: number;
  currency?: string;
  credited?: boolean;
};

/**
 * The browser needs an absolute URL it can return to. We use the Expo
 * dev server / public preview origin so Stripe redirect comes back to a
 * valid URL. On production builds, set EXPO_PUBLIC_RETURN_ORIGIN.
 */
function getOriginUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_RETURN_ORIGIN;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  // Try EXPO_BACKEND_URL (which is the same host as the frontend on Emergent)
  const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backend) return backend.replace(/\/+$/, "").replace(/\/api$/, "");
  // Fallback to expo's manifest hostUri
  const hostUri = (Constants as any)?.expoConfig?.hostUri;
  if (hostUri) return `https://${String(hostUri).split(":")[0]}`;
  return "https://app.invalid";
}

async function pollStatus(sessionId: string, maxAttempts = 12): Promise<CheckoutStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const s = await api<CheckoutStatus>(`/billing/checkout/status/${sessionId}`);
      if (s.payment_status === "paid" || s.status === "expired") return s;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { session_id: sessionId, status: "timeout", payment_status: "unpaid" };
}

/**
 * Opens Stripe Checkout in an in-app browser, then polls the backend for
 * the final payment status. Returns the final status (or null on cancel).
 */
export async function startCheckout(
  packageId: PackageId,
  options: { jobId?: string } = {}
): Promise<CheckoutStatus | null> {
  const originUrl = getOriginUrl();

  // 1) Create a checkout session on the backend
  const created = await api<{ url: string; session_id: string }>("/billing/checkout", {
    method: "POST",
    body: { package_id: packageId, origin_url: originUrl, job_id: options.jobId },
  });

  // 2) Open the Stripe-hosted checkout in an in-app browser
  if (Platform.OS === "web") {
    // On web we just navigate
    window.location.href = created.url;
    return null;
  }

  const result = await WebBrowser.openBrowserAsync(created.url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: "close",
    showTitle: true,
  });

  // 3) Whether they finished or dismissed, poll once for the status
  const status = await pollStatus(created.session_id);

  // Suppress unused var warning
  void result;
  return status;
}
