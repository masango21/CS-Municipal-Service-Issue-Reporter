import Link from "next/link";

export default function AdminRegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-xl font-bold text-white">
            MS
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white">Municipal Administrator</h1>
        </div>

        <form className="space-y-5">
          <div>
            <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-slate-200">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
              Staff / Admin Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-200">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-500"
          >
            Create Staff Account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          Already registered? {" "}
          <Link href="/admin/login" className="font-semibold text-cyan-400">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
