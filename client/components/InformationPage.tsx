import type { ReactNode } from "react";
import Link from "next/link";

type InformationPageProps = {
  title: string;
  intro: string;
  children: ReactNode;
};

export function InformationPage({ title, intro, children }: InformationPageProps) {
  return (
    <main className="min-h-[60vh] bg-slate-50 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <Link href="/" className="transition hover:text-emerald-700">
            Home
          </Link>
          <span aria-hidden="true" className="mx-2 text-slate-400">/</span>
          <span aria-current="page" className="text-slate-700">{title}</span>
        </nav>

        <header className="mt-7 border-b border-slate-200 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Municipal Service Issue Reporter
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{intro}</p>
        </header>

        <div className="divide-y divide-slate-200">{children}</div>
      </div>
    </main>
  );
}