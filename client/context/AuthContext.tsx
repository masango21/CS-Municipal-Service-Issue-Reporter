"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Role = "resident" | "staff" | "super_admin";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type AuthResult = {
  ok: boolean;
  message: string;
  user?: AppUser;
};

type AuthContextValue = {
  currentUser: AppUser | null;
  residentUser: AppUser | null;
  adminUser: AppUser | null;
  isAuthReady: boolean;
  isResidentLoggedIn: boolean;
  isAdminLoggedIn: boolean;
  registerResident: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<AuthResult>;
  loginResident: (email: string, password: string) => Promise<AuthResult>;
  registerAdmin: (payload: {
    name: string;
    email: string;
    password: string;
    registrationKey: string;
  }) => Promise<AuthResult>;
  loginAdmin: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function authenticate(path: string, payload: Record<string, string>, role: Role): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as {
      message?: string;
      user?: Omit<AppUser, "role"> & { role?: Role };
      admin?: Omit<AppUser, "role"> & { role?: Role };
    };
    const account = result.user ?? result.admin;

    if (!response.ok || !account?.id || !account.email || !account.name) {
      return { ok: false, message: result.message ?? "Authentication failed." };
    }

    return {
      ok: true,
      message: result.message ?? "Authentication successful.",
      user: { ...account, role: account.role ?? role },
    };
  } catch {
    return { ok: false, message: "Authentication service is unavailable. Please try again." };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [residentUser, setResidentUser] = useState<AppUser | null>(null);
  const [adminUser, setAdminUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    for (const key of [
      "municipal-service-resident-accounts",
      "municipal-service-resident-session",
      "municipal-service-admin-session",
    ]) {
      window.localStorage.removeItem(key);
    }

    fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session lookup failed");
        return response.json() as Promise<{ user?: AppUser | null }>;
      })
      .then(({ user }) => {
        if (!active) return;
        setResidentUser(user?.role === "resident" ? user : null);
        setAdminUser(user?.role === "staff" || user?.role === "super_admin" ? user : null);
      })
      .catch(() => {
        if (!active) return;
        setResidentUser(null);
        setAdminUser(null);
      })
      .finally(() => {
        if (active) setIsAuthReady(true);
      });

    return () => { active = false; };
  }, []);

  const currentUser = residentUser ?? adminUser;

  const registerResident = useCallback(async ({ name, email, password, phone }: {
    name: string; email: string; password: string; phone?: string;
  }) => {
    if (!name.trim() || !email.trim() || password.length < 12) {
      return { ok: false, message: "Enter your name, a valid email, and a password with at least 12 characters." };
    }
    const result = await authenticate("/api/auth/register", { name, email, password, phone: phone ?? "" }, "resident");
    if (result.ok && result.user) {
      setResidentUser(result.user);
      setAdminUser(null);
    }
    return result;
  }, []);

  const loginResident = useCallback(async (email: string, password: string) => {
    const result = await authenticate("/api/auth/login", { email, password }, "resident");
    if (result.ok && result.user) {
      setResidentUser(result.user);
      setAdminUser(null);
    }
    return result;
  }, []);

  const registerAdmin = useCallback(
    async ({ name, email, password, registrationKey }: { name: string; email: string; password: string; registrationKey: string }) => {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedName || !trimmedEmail || !password.trim() || !registrationKey.trim()) {
        return { ok: false, message: "Please complete all required fields." };
      }

      const result = await authenticate("/api/admin/register", {
        name: trimmedName, email: trimmedEmail, password, registrationKey,
      }, "staff");
      if (result.ok && result.user) {
        setAdminUser(result.user);
        setResidentUser(null);
      }
      return result;
    },
    [],
  );

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail || !password.trim()) {
        return { ok: false, message: "Email and password are required." };
      }

      const result = await authenticate("/api/admin/login", { email: trimmedEmail, password }, "staff");
      if (result.ok && result.user) {
        setAdminUser(result.user);
        setResidentUser(null);
      }
      return result;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Clear in-memory state even when the server cannot be reached.
    } finally {
      setResidentUser(null);
      setAdminUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      residentUser,
      adminUser,
      isAuthReady,
      isResidentLoggedIn: Boolean(residentUser),
      isAdminLoggedIn: Boolean(adminUser),
      registerResident,
      loginResident,
      registerAdmin,
      loginAdmin,
      logout,
    }),
    [adminUser, currentUser, isAuthReady, loginAdmin, loginResident, logout, registerAdmin, registerResident, residentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
