"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Logo, Card, InputField, Pill } from "@/components/ui";

export default function LoginPage() {
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
    const { data, error } = await supa.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const role = (data.user?.app_metadata as { role?: string } | undefined)?.role;
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next || (role === "counter_staff" ? "/counter" : "/admin"));
    router.refresh();
  }

  const fillQuick = (acc: "owner" | "counter") => {
    if (acc === "owner") {
      setEmail("owner@spicepizza.local");
      setPassword("owner1234");
    } else {
      setEmail("counter@spicepizza.local");
      setPassword("counter1234");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-cream via-white to-brand-tint/30">
      <Card className="w-full max-w-md p-8 shadow-xl border-hairline/80 backdrop-blur-md">
        <form onSubmit={submit} className="space-y-5">
          <div className="flex flex-col items-center text-center">
            <Logo size={64} className="mb-3" />
            <h1 className="text-2xl font-black tracking-tight text-ink">Spice Pizza</h1>
            <p className="mt-1 text-xs text-muted">Order Management & POS Admin System</p>
          </div>

          <div className="space-y-3 pt-2">
            <InputField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@spicepizza.local"
              autoComplete="username"
              required
            />

            <InputField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-sm font-bold shadow-md shadow-brand/20"
            loading={busy}
            disabled={!email || !password}
          >
            Sign In to Terminal
          </Button>

          {/* Quick Demo Fill Accounts */}
          <div className="pt-4 border-t border-hairline space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Quick Demo Accounts</span>
              <Pill tone="blue" className="text-[10px]">Dev Seeded</Pill>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillQuick("owner")}
                className="rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-left hover:border-brand/40 hover:bg-surface transition-all"
              >
                <div className="text-xs font-bold text-ink">Bilal (Owner)</div>
                <div className="text-[10px] text-muted">owner@spicepizza.local</div>
              </button>
              <button
                type="button"
                onClick={() => fillQuick("counter")}
                className="rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-left hover:border-brand/40 hover:bg-surface transition-all"
              >
                <div className="text-xs font-bold text-ink">AK (Counter)</div>
                <div className="text-[10px] text-muted">counter@spicepizza.local</div>
              </button>
            </div>
          </div>
        </form>
      </Card>
    </main>
  );
}
