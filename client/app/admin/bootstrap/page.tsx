"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { bootstrapSuperAdmin } from "@/lib/municipalities";

export default function SuperAdminBootstrapPage() {
  const router = useRouter();
  const { adminUser, residentUser, isAuthReady } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthReady) return;
    if (adminUser) router.replace(adminUser.role === "super_admin" ? "/admin/municipalities" : "/admin/dashboard");
    else if (residentUser) router.replace("/dashboard");
  }, [adminUser, isAuthReady, residentUser, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await bootstrapSuperAdmin({ name, email, password, bootstrapToken });
      setBootstrapToken("");
      window.location.replace("/admin/municipalities");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to initialize super-admin access.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-7 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Initial system setup</p>
        <h1 className="mt-3 text-3xl font-bold">Create super-admin</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">This bootstrap can succeed only once. Keep the bootstrap token in the server environment and never share it through chat.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-200">Full name</label>
            <input id="name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white" />
          </div>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">Email address</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white" />
          </div>
          <div>
            <label htmlFor="bootstrap-token" className="mb-2 block text-sm font-medium text-slate-200">Bootstrap token</label>
            <input id="bootstrap-token" type="password" required autoComplete="off" value={bootstrapToken} onChange={(event) => setBootstrapToken(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
              <input id="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-200">Confirm password</label>
              <input id="confirm-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white" />
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-cyan-700 px-4 py-3 font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">{isSubmitting ? "Creating account..." : "Create first super-admin"}</button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400"><Link href="/admin/login" className="font-semibold text-cyan-300 hover:text-cyan-200">Return to staff login</Link></p>
      </section>
    </main>
  );
}