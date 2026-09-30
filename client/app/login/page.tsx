"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

function getResidentLoginDestination() {
  if (typeof window === "undefined") return "/dashboard";
  return new URLSearchParams(window.location.search).get("next") === "/report"
    ? "/report"
    : "/dashboard";
}

export default function ResidentLoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { residentUser, adminUser, isAuthReady, loginResident } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthReady) return;
    if (residentUser) {
      router.replace(getResidentLoginDestination());
    } else if (adminUser) {
      router.replace("/admin/dashboard");
    }
  }, [adminUser, isAuthReady, residentUser, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await loginResident(email, password);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError("");
    router.push(getResidentLoginDestination());
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white">
            MS
          </div>
          <h1 className="mt-5 text-3xl font-bold text-slate-900">{t("loginResidentTitle")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("loginResidentText")}</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              {t("emailAddress")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              {t("password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            {t("login")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {t("noAccount")} {" "}
          <Link href="/register" className="font-semibold text-emerald-700">
            {t("register")}
          </Link>
        </p>
      </div>
    </main>
  );
}
