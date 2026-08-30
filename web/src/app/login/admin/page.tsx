"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supa = createClient();
    const { data, error } = await supa.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const role = (data.user?.app_metadata as { role?: string } | undefined)?.role;
    if (role !== "owner") {
      await supa.auth.signOut();
      setError("Access denied. This portal is for admin owners only. Use the Counter Terminal login.");
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #fff8f7 0%, #FCF9F5 40%, #ffdad6 100%)",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-16 w-[400px] h-[400px] rounded-full bg-[#af101a]/8" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#ffdad6] opacity-50" />
        {/* Geometric accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#af101a]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold mb-8 hover:text-[#af101a] transition-colors"
          style={{ color: "#605e5b" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            arrow_back
          </span>
          Back to Portal Select
        </Link>

        {/* Card */}
        <div
          className="rounded-3xl shadow-xl overflow-hidden"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 20px 60px rgba(175, 16, 26, 0.12)" }}
        >
          {/* Red header band */}
          <div
            className="px-8 py-6 flex items-center gap-4"
            style={{ backgroundColor: "#af101a" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <span
                className="material-symbols-outlined text-white"
                style={{ fontSize: "30px", fontVariationSettings: "'FILL' 1" }}
              >
                admin_panel_settings
              </span>
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Admin Panel</h1>
              <p className="text-sm text-red-200 mt-0.5">Bites Pizza · Main Branch</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="px-8 py-7 space-y-5">
            <div>
              <p className="text-sm font-semibold mb-5" style={{ color: "#605e5b" }}>
                Sign in with your owner credentials to access the admin panel.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: "#5b403d" }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@spicepizza.local"
                    autoComplete="username"
                    required
                    className="w-full h-12 px-4 rounded-xl border-2 outline-none text-sm transition-all"
                    style={{
                      borderColor: "#e4beba",
                      backgroundColor: "#fff8f7",
                      color: "#1A1A1A",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#af101a")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#e4beba")}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: "#5b403d" }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full h-12 px-4 rounded-xl border-2 outline-none text-sm transition-all"
                    style={{
                      borderColor: "#e4beba",
                      backgroundColor: "#fff8f7",
                      color: "#1A1A1A",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#af101a")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#e4beba")}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div
                className="rounded-xl border p-3.5 text-sm font-semibold flex items-start gap-2"
                style={{ borderColor: "#ffdad6", backgroundColor: "#fff0ef", color: "#af101a" }}
              >
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: "18px" }}>
                  error
                </span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full h-12 rounded-xl font-black text-sm text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                backgroundColor: busy ? "#8b0d14" : "#af101a",
                boxShadow: "0 4px 16px rgba(175,16,26,0.35)",
              }}
            >
              {busy ? (
                <>
                  <span
                    className="material-symbols-outlined animate-spin"
                    style={{ fontSize: "18px" }}
                  >
                    progress_activity
                  </span>
                  Signing in…
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}
                  >
                    lock_open
                  </span>
                  Sign In to Admin Panel
                </>
              )}
            </button>

            {/* Quick fill for dev (hidden in production) */}
            {process.env.NODE_ENV !== "production" && (
              <div className="pt-2 border-t" style={{ borderColor: "#e4beba" }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#8f6f6c" }}>
                  Dev shortcut
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("owner@spicepizza.local");
                    setPassword("owner1234");
                  }}
                  className="w-full text-left rounded-xl border px-4 py-2.5 hover:bg-[#fff0ef] transition-colors"
                  style={{ borderColor: "#e4beba" }}
                >
                  <div className="text-xs font-bold" style={{ color: "#1A1A1A" }}>
                    Owner Account
                  </div>
                  <div className="text-[10px]" style={{ color: "#605e5b" }}>
                    owner@spicepizza.local
                  </div>
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
