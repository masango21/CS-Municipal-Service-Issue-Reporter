"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Report an Issue", href: "/report" },
  { label: "My Reports", href: "/dashboard" },
  { label: "Map / Issues", href: "/issues" },
];

const serviceCategories = [
  "Potholes",
  "Water Leaks",
  "Broken Streetlights",
  "Other Municipal Issues",
];

const supportItems = [
  { label: "Help / FAQ", href: "/help" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
];

export function Footer() {
  const pathname = usePathname();

  const shouldRenderFooter =
    Boolean(pathname) &&
    !pathname.startsWith("/admin") &&
    pathname !== "/login" &&
    pathname !== "/register" &&
    pathname !== "/dashboard";

  if (!shouldRenderFooter) {
    return null;
  }

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
                MS
              </div>
              <div>
                <p className="text-lg font-bold text-white">Municipal Service Issue Reporter</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300">
              Report municipal service problems, track progress, and help improve your community.
            </p>
          </div>

          <nav aria-label="Quick links" className="xl:pl-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Quick Links
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {quickLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-md text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/about"
                  className="inline-flex rounded-md text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  About
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Service Categories
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {serviceCategories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Support
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {supportItems.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-md text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-slate-800 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Staff Access
              </h2>
              <Link
                href="/admin/login"
                className="mt-3 inline-flex rounded-md text-sm font-medium text-slate-300 transition hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Staff Login
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 text-sm text-slate-400">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Municipal Service Issue Reporter</p>
            <p>Developed as an Information Technology project.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
