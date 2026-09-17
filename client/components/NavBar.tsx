import Link from "next/link";

export function NavBar() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white">
            MS
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">Municipal Service Reporter</p>
            <p className="text-xs text-slate-500">South Africa</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          <Link href="/" className="transition hover:text-emerald-700">Home</Link>
          <Link href="/report" className="transition hover:text-emerald-700">Report Issue</Link>
          <Link href="/issues" className="transition hover:text-emerald-700">Issue Feed</Link>
          <Link href="/dashboard" className="transition hover:text-emerald-700">Dashboard</Link>
          <Link href="/admin/dashboard" className="transition hover:text-emerald-700">Admin</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Resident Login
          </Link>
          <Link
            href="/admin/login"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Staff Login
          </Link>
        </div>
      </div>
    </header>
  );
}
