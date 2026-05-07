import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";
import { registerForPushNotifications, unregisterPushToken } from "./notifications";

export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  bio?: string;
  avatar?: string | null;
  is_verified: boolean;
  role: "user" | "admin";
  banned: boolean;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  is_pro?: boolean;
  pro_expires_at?: string | null;
  has_background_check?: boolean;
  id_verification_paid?: boolean;
  created_at?: string;
  deletion_requested?: boolean;
  deletion_requested_at?: string | null;
  deletion_reason?: string | null;
  deleted?: boolean;
};

type AuthState = {
  user: User | null | undefined; // undefined = loading
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (
    email: string,
    password: string,
    name: string,
    phone?: string,
    eula?: { accepted: boolean; version: string }
  ) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUserState(null);
        return;
      }
      try {
        const me = await api<User>("/auth/me");
        setUserState(me);
        // Kick off push registration once we have a user (non-blocking)
        registerForPushNotifications().catch(() => {});
      } catch {
        await setToken(null).catch(() => {});
        setUserState(null);
      }
    } catch {
      // Fail-safe: never leave the splash hanging on storage / network errors
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    await setToken(res.token);
    setUserState(res.user);
    registerForPushNotifications().catch(() => {});
    return res.user;
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    phone?: string,
    eula?: { accepted: boolean; version: string }
  ) => {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: {
        email,
        password,
        name,
        phone,
        eula_accepted: !!eula?.accepted,
        eula_version: eula?.version,
      },
      auth: false,
    });
    await setToken(res.token);
    setUserState(res.user);
    registerForPushNotifications().catch(() => {});
    return res.user;
  };

  const signOut = async () => {
    await unregisterPushToken().catch(() => {});
    await setToken(null);
    setUserState(null);
  };

  return (
    <AuthCtx.Provider value={{ user, signIn, signUp, signOut, refresh, setUser: setUserState as any }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
