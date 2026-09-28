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

type Role = "resident" | "admin";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  token?: string;
};

type ResidentAccount = AppUser & {
  password: string;
  phone?: string;
  createdAt: string;
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
  }) => AuthResult;
  loginResident: (email: string, password: string) => AuthResult;
  registerAdmin: (payload: {
    name: string;
    email: string;
    password: string;
    registrationKey: string;
  }) => Promise<AuthResult>;
  loginAdmin: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
};

const RESIDENT_KEY = "municipal-service-resident-accounts";
const RESIDENT_SESSION_KEY = "municipal-service-resident-session";
const ADMIN_SESSION_KEY = "municipal-service-admin-session";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredAccounts<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.error(`Failed to read accounts from ${key}`, error);
    return [];
  }
}

function writeStoredAccounts<T>(key: string, accounts: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(accounts));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [residentUser, setResidentUser] = useState<AppUser | null>(null);
  const [adminUser, setAdminUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedResident = window.localStorage.getItem(RESIDENT_SESSION_KEY);
        const storedAdmin = window.localStorage.getItem(ADMIN_SESSION_KEY);

        const parsedResident = storedResident ? (JSON.parse(storedResident) as AppUser | null) : null;
        const parsedAdmin = storedAdmin ? (JSON.parse(storedAdmin) as AppUser | null) : null;

        setResidentUser(parsedResident && parsedResident.role === "resident" ? parsedResident : null);
        setAdminUser(parsedAdmin && parsedAdmin.role === "admin" ? parsedAdmin : null);
      } catch (error) {
        console.error("Failed to parse auth sessions", error);
        setResidentUser(null);
        setAdminUser(null);
      } finally {
        setIsAuthReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const currentUser = residentUser ?? adminUser;

  const persistResidentSession = useCallback((user: AppUser | null) => {
    if (typeof window === "undefined") {
      return;
    }

    if (!user) {
      window.localStorage.removeItem(RESIDENT_SESSION_KEY);
      setResidentUser(null);
      return;
    }

    window.localStorage.setItem(RESIDENT_SESSION_KEY, JSON.stringify(user));
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    setResidentUser(user);
    setAdminUser(null);
  }, []);

  const persistAdminSession = useCallback((user: AppUser | null) => {
    if (typeof window === "undefined") {
      return;
    }

    if (!user) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      setAdminUser(null);
      return;
    }

    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
    window.localStorage.removeItem(RESIDENT_SESSION_KEY);
    setAdminUser(user);
    setResidentUser(null);
  }, []);

  const registerResident = useCallback(
    ({ name, email, password, phone }: { name: string; email: string; password: string; phone?: string }) => {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedName || !trimmedEmail || !password.trim()) {
        return { ok: false, message: "Please complete all required fields." };
      }

      const accounts = readStoredAccounts<ResidentAccount>(RESIDENT_KEY);
      const exists = accounts.some((account) => account.email.toLowerCase() === trimmedEmail);

      if (exists) {
        return { ok: false, message: "A resident account with this email already exists." };
      }

      const nextUser: ResidentAccount = {
        id: makeId("USR"),
        name: trimmedName,
        email: trimmedEmail,
        role: "resident",
        password,
        phone: phone?.trim() || "",
        createdAt: new Date().toISOString(),
      };

      writeStoredAccounts(RESIDENT_KEY, [...accounts, nextUser]);
      const sessionUser: AppUser = {
        id: nextUser.id,
        name: nextUser.name,
        email: nextUser.email,
        role: "resident",
      };
      persistResidentSession(sessionUser);

      return { ok: true, message: "Resident account created successfully.", user: sessionUser };
    },
    [persistResidentSession],
  );

  const loginResident = useCallback(
    (email: string, password: string) => {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail || !password.trim()) {
        return { ok: false, message: "Email and password are required." };
      }

      const accounts = readStoredAccounts<ResidentAccount>(RESIDENT_KEY);
      const account = accounts.find(
        (entry) => entry.email.toLowerCase() === trimmedEmail && entry.password === password,
      );

      if (!account) {
        return { ok: false, message: "Incorrect email or password." };
      }

      const sessionUser: AppUser = {
        id: account.id,
        name: account.name,
        email: account.email,
        role: "resident",
      };

      persistResidentSession(sessionUser);
      return { ok: true, message: "Resident login successful.", user: sessionUser };
    },
    [persistResidentSession],
  );

  const registerAdmin = useCallback(
    async ({ name, email, password, registrationKey }: { name: string; email: string; password: string; registrationKey: string }) => {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedName || !trimmedEmail || !password.trim() || !registrationKey.trim()) {
        return { ok: false, message: "Please complete all required fields." };
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName, email: trimmedEmail, password, registrationKey }),
        });
        const payload = await response.json() as { message?: string; admin?: Omit<AppUser, "role">; token?: string };
        if (!response.ok || !payload.admin || !payload.token) {
          return { ok: false, message: payload.message ?? "Staff registration failed." };
        }
        const sessionUser: AppUser = { ...payload.admin, role: "admin", token: payload.token };
        persistAdminSession(sessionUser);
        return { ok: true, message: payload.message ?? "Admin account created successfully.", user: sessionUser };
      } catch {
        return { ok: false, message: "Staff service is unavailable. Please try again." };
      }
    },
    [persistAdminSession],
  );

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail || !password.trim()) {
        return { ok: false, message: "Email and password are required." };
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
        const payload = await response.json() as { message?: string; admin?: Omit<AppUser, "role">; token?: string };
        if (!response.ok || !payload.admin || !payload.token) {
          return { ok: false, message: payload.message ?? "Incorrect email or password." };
        }
        const sessionUser: AppUser = { ...payload.admin, role: "admin", token: payload.token };
        persistAdminSession(sessionUser);
        return { ok: true, message: payload.message ?? "Admin login successful.", user: sessionUser };
      } catch {
        return { ok: false, message: "Staff service is unavailable. Please try again." };
      }
    },
    [persistAdminSession],
  );

  const logout = useCallback(() => {
    persistResidentSession(null);
    persistAdminSession(null);
  }, [persistAdminSession, persistResidentSession]);

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
