"use client";

/** Spinning brand ring — used inline and inside the full-screen LoadingScreen. */
export function Spinner({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-[#e4beba] border-t-[#af101a]"
      style={{ width: size, height: size, borderWidth: Math.max(3, Math.round(size / 12)) }}
      aria-hidden
    />
  );
}

/**
 * Full-screen branded loading state — shown whenever a page is fetching its data.
 * Centered spinner + wordmark on the app's cream background.
 */
export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-[#FCF9F5]"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="relative grid place-items-center">
        <Spinner size={56} />
        <span className="material-symbols-outlined absolute text-[#af101a]" style={{ fontSize: "24px" }}>
          local_pizza
        </span>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold tracking-tight text-[#af101a]">Spice Pizza</div>
        <div className="mt-0.5 text-xs font-semibold text-[#605e5b]" aria-live="polite">{label}</div>
      </div>
    </div>
  );
}
