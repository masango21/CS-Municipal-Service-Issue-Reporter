"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { adminUser, isAuthReady, loginAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthReady && adminUser) {
      router.replace("/admin/dashboard");
    }
  }, [adminUser, isAuthReady, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await loginAdmin(email, password);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError("");
    router.push("/admin/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-xl font-bold text-white">
            MS
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white">{t("staffLoginTitle")}</h1>
          <p className="mt-2 text-sm text-slate-300">{t("staffLoginText")}</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
              {t("emailAddress")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">
              {t("password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-500"
          >
            {t("login")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          {t("needAccess")} {" "}
          <Link href="/admin/register" className="font-semibold text-cyan-400">
            {t("registerStaffAccount")}
          </Link>
        </p>
      </div>
    </main>
  );
}
