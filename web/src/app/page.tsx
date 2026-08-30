import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand text-2xl font-bold text-white shadow-sm">
            S
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Bites Pizza</h1>
          <p className="mt-1 text-sm text-muted">Best food in town — order management</p>
        </div>

        <div className="mt-8 grid gap-3">
          <Link
            href="/counter"
            className="group flex items-center justify-between rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-sm transition hover:border-brand/40 hover:shadow"
          >
            <div>
              <div className="font-semibold">Counter Screen</div>
              <div className="text-sm text-muted">Tables, orders, printing, billing</div>
            </div>
            <span className="text-brand transition group-hover:translate-x-0.5">→</span>
          </Link>

          <Link
            href="/admin"
            className="group flex items-center justify-between rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-sm transition hover:border-brand/40 hover:shadow"
          >
            <div>
              <div className="font-semibold">Admin Panel</div>
              <div className="text-sm text-muted">Sales, reports, menu, payments</div>
            </div>
            <span className="text-brand transition group-hover:translate-x-0.5">→</span>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Counter is laptop-first · Admin works great on your phone
        </p>
      </div>
    </main>
  );
}
