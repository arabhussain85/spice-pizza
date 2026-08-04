"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Logo } from "@/components/ui";

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

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-3 text-xl font-bold">Spice Pizza</h1>
          <p className="text-sm text-muted">Sign in to continue</p>
        </div>

        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand/50"
        />

        <label className="mb-1 mt-3 block text-sm font-medium">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand/50"
        />

        {error && <p className="mt-3 text-sm text-brand">{error}</p>}

        <Button type="submit" className="mt-5 w-full py-3" disabled={busy || !email || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
