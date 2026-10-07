"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export function NavBar() {
  const { locale, setLocale, t, languages } = useLanguage();
  const { residentUser, adminUser, logout } = useAuth();

  const currentRole = residentUser ? "resident" : adminUser ? adminUser.role : null;

  const publicNav = [
    { href: "/", label: t("navHome") },
    { href: "/report", label: t("navReport") },
    { href: "/issues", label: t("navFeed") },
  ];

  const residentNav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/report", label: "Report Issue" },
    { href: "/issues", label: "My Feed" },
  ];

  const adminNav = [
    { href: "/admin/dashboard", label: "Operations" },
    { href: "/admin/dashboard#queue", label: "Report queue" },
  ];

  const superAdminNav = [
    { href: "/admin/municipalities", label: "Municipalities" },
    { href: "/admin/staff", label: "Staff access" },
  ];
  const isAdminRole = currentRole === "staff" || currentRole === "super_admin";
  const navItems = currentRole === "resident" ? residentNav : currentRole === "staff" ? adminNav : currentRole === "super_admin" ? superAdminNav : publicNav;
  const activeUser = currentRole === "resident" ? residentUser : isAdminRole ? adminUser : null;

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white ${isAdminRole ? "bg-cyan-600" : "bg-emerald-600"}`}>
            MS
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{t("appName")}</p>
            <p className="text-xs text-slate-500">{currentRole === "super_admin" ? "System administration" : isAdminRole ? "Municipal operations" : t("location")}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          {navItems.map((item) => (
            <Link key={item.href + item.label} href={item.href} className="transition hover:text-emerald-700">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <label className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 md:flex">
            <span>{t("languageLabel")}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
              className="bg-transparent pr-1 font-medium text-slate-800 outline-none"
              aria-label={t("languageLabel")}
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>

          {activeUser ? (
            <>
              <div className={`hidden rounded-full border px-3 py-2 text-xs font-semibold md:block ${isAdminRole ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                {currentRole === "super_admin" ? "Super Admin" : currentRole === "staff" ? "Municipal Staff" : "Resident"} · {activeUser.name.split(" ")[0]}
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              {t("residentLogin")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
