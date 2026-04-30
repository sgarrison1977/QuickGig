import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "qg_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

type Options = {
  method?: string;
  body?: any;
  auth?: boolean;
  query?: Record<string, any>;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = opts;
  let url = `${BACKEND_URL}/api${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data: any = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = txt;
  }
  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      (typeof data === "string" ? data : `Error ${res.status}`);
    const msg = Array.isArray(detail)
      ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
      : typeof detail === "string"
      ? detail
      : JSON.stringify(detail);
    throw new Error(msg);
  }
  return data as T;
}

export const CATEGORIES = [
  { key: "lawn",     label: "Lawn Care", emoji: "🌿", color: "#A8E6A0", image: "https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=400&q=60" },
  { key: "cleaning", label: "Cleaning",  emoji: "🧽", color: "#4ECDC4", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=60" },
  { key: "painting", label: "Painting",  emoji: "🎨", color: "#FF9F1C", image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=400&q=60" },
  { key: "handyman", label: "Handyman",  emoji: "🔧", color: "#FFE66D", image: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=400&q=60" },
  { key: "moving",   label: "Moving",    emoji: "📦", color: "#FF6B6B", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=60" },
  { key: "pet",      label: "Pet Care",  emoji: "🐾", color: "#C9A0FF", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=400&q=60" },
  { key: "errands",  label: "Errands",   emoji: "🛒", color: "#7FC8F8", image: "https://images.unsplash.com/photo-1601598851547-4302969d0614?auto=format&fit=crop&w=400&q=60" },
  { key: "other",    label: "Other",     emoji: "✨", color: "#F4A6CD", image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=400&q=60" },
];

export function categoryMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}
