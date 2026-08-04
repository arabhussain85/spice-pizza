"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";
import { Button, Card, cn } from "@/components/ui";
import { updateSettings } from "../actions";

export default function SettingsPage() {
  const supaRef = useRef(createClient());
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supaRef.current
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setS(data as Settings);
      });
  }, []);

  if (error && !s)
    return (
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      </div>
    );
  if (!s) return <div className="text-sm text-muted">Loading…</div>;

  const patch = (p: Partial<Settings>) => setS({ ...s, ...p });

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card className="mt-4 space-y-4 p-4">
        <Field label="Brand name">
          <input
            value={s.brand_name}
            onChange={(e) => patch({ brand_name: e.target.value })}
            className="w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
        </Field>

        <Field label="Service charge %">
          <input
            type="number"
            inputMode="decimal"
            value={String(s.service_charge_pct)}
            onChange={(e) => patch({ service_charge_pct: Number(e.target.value) })}
            className="w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
        </Field>

        <Field label="Who can apply discounts">
          <div className="flex gap-2">
            {(["owner", "any"] as const).map((r) => (
              <button
                key={r}
                onClick={() => patch({ discounts_role: r })}
                className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-medium", s.discounts_role === r ? "border-brand bg-brand text-white" : "border-hairline")}
              >
                {r === "owner" ? "Owner only (PIN)" : "Any staff"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Raw-data retention (days)">
          <input
            type="number"
            inputMode="numeric"
            value={String(s.retention_days)}
            onChange={(e) => patch({ retention_days: Number(e.target.value) })}
            className="w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <p className="mt-1 text-xs text-muted">Older orders roll up into daily summaries and raw detail is purged.</p>
        </Field>
      </Card>

      <Button
        className="mt-4 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setSaved(false);
          try {
            await updateSettings({
              brand_name: s.brand_name,
              service_charge_pct: s.service_charge_pct,
              discounts_role: s.discounts_role,
              retention_days: s.retention_days,
            });
            setSaved(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save settings"}
      </Button>
      {saved && <p className="mt-2 text-center text-sm text-free-dark">Saved.</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
