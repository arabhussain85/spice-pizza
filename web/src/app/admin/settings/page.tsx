"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";
import { Button, Card, Pill, cn, InputField } from "@/components/ui";
import { updateSettings } from "../actions";
import {
  getCounterPin,
  setCounterPin,
  getDiscountPin,
  setDiscountPin,
} from "../settings-actions";

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
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-ink">Settings</h1>
        <div className="rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      </div>
    );
  if (!s) return <div className="p-8 text-center text-sm font-semibold text-muted">Loading settings…</div>;

  const patch = (p: Partial<Settings>) => setS({ ...s, ...p });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Admin Settings</h1>
          <p className="mt-1 text-xs text-muted">Configure store preferences, receipt formatting, and hardware printers.</p>
        </div>
      </div>

      {/* Settings Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border-2 border-brand bg-brand-tint/30 p-4 shadow-2xs">
          <div className="text-xl mb-1">⚙️</div>
          <h3 className="font-bold text-sm text-brand">General Settings</h3>
          <p className="text-xs text-muted mt-1">Brand name, tax rates & data retention</p>
        </div>

        <Link href="/admin/settings/receipt" className="group">
          <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-2xs transition-all hover:border-brand/40 hover:bg-cream/40 hover:shadow-xs">
            <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🧾</div>
            <h3 className="font-bold text-sm text-ink group-hover:text-brand">Receipt Customizer</h3>
            <p className="text-xs text-muted mt-1">Customize headers, footers & live layout preview</p>
          </div>
        </Link>

        <Link href="/admin/settings/printer" className="group">
          <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-2xs transition-all hover:border-brand/40 hover:bg-cream/40 hover:shadow-xs">
            <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🖨️</div>
            <h3 className="font-bold text-sm text-ink group-hover:text-brand">Printer Section</h3>
            <p className="text-xs text-muted mt-1">Configure thermal printer bridge & test prints</p>
          </div>
        </Link>
      </div>

      {/* Main Settings Form */}
      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Store Configuration</h2>

        <InputField
          label="Brand / Restaurant Name"
          value={s.brand_name}
          onChange={(e) => patch({ brand_name: e.target.value })}
        />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
            Service Charge Percentage (%)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={String(s.service_charge_pct)}
            onChange={(e) => patch({ service_charge_pct: Number(e.target.value) })}
            className="w-full rounded-xl border border-hairline bg-cream/30 px-3.5 py-2.5 text-sm outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
            Discount Authorization Role
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["owner", "any"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => patch({ discounts_role: r })}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                  s.discounts_role === r
                    ? "border-brand bg-brand text-white shadow-xs"
                    : "border-hairline bg-cream/30 text-ink-muted hover:border-brand/30"
                )}
              >
                {r === "owner" ? "Owner Only (PIN)" : "Any Counter Staff"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
            Raw-Data Retention Policy (Days)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={String(s.retention_days)}
            onChange={(e) => patch({ retention_days: Number(e.target.value) })}
            className="w-full rounded-xl border border-hairline bg-cream/30 px-3.5 py-2.5 text-sm outline-none focus:border-brand"
          />
          <p className="mt-1.5 text-xs text-muted">
            Older completed orders automatically roll up into daily summaries and raw item logs are purged.
          </p>
        </div>

        <Button
          className="w-full py-3 text-sm shadow-md"
          loading={busy}
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
          {saved ? "✓ Settings Saved" : "Save Store Configuration"}
        </Button>

        {saved && <p className="text-center text-xs font-bold text-free-dark animate-in fade-in">✓ Changes saved successfully.</p>}
      </Card>

      <SecurityCard />
    </div>
  );
}

function SecurityCard() {
  const supaRef = useRef(createClient());
  const [counterPin, setCounterPinState] = useState("");
  const [discountPin, setDiscountPinState] = useState("");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [passMsg, setPassMsg] = useState<string | null>(null);

  useEffect(() => {
    getCounterPin().then(setCounterPinState);
    getDiscountPin().then(setDiscountPinState);
  }, []);

  async function savePins() {
    setBusy(true);
    setPinMsg(null);
    try {
      await setCounterPin(counterPin.trim());
      await setDiscountPin(discountPin.trim());
      setPinMsg("PINs updated.");
      setTimeout(() => setPinMsg(null), 3000);
    } catch (e) {
      setPinMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (newPass.length < 6) {
      setPassMsg("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setPassMsg(null);
    const { error } = await supaRef.current.auth.updateUser({ password: newPass });
    setBusy(false);
    if (error) {
      setPassMsg(error.message);
    } else {
      setNewPass("");
      setPassMsg("Password changed.");
      setTimeout(() => setPassMsg(null), 3000);
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Access &amp; Security</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
            Counter Terminal PIN
          </label>
          <input
            value={counterPin}
            onChange={(e) => setCounterPinState(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            placeholder="4 digits"
            className="w-full rounded-xl border border-hairline bg-cream/30 px-3.5 py-2.5 text-sm font-bold tracking-[0.3em] outline-none focus:border-brand"
          />
          <p className="mt-1 text-xs text-muted">Staff type this to unlock the counter.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
            Owner Discount PIN
          </label>
          <input
            value={discountPin}
            onChange={(e) => setDiscountPinState(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="up to 6 digits"
            className="w-full rounded-xl border border-hairline bg-cream/30 px-3.5 py-2.5 text-sm font-bold tracking-[0.3em] outline-none focus:border-brand"
          />
          <p className="mt-1 text-xs text-muted">Required to authorize discounts.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button loading={busy} disabled={!counterPin || !discountPin} onClick={savePins}>
          Save PINs
        </Button>
        {pinMsg && <span className="text-xs font-bold text-free-dark">{pinMsg}</span>}
      </div>

      <div className="border-t border-hairline pt-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
          Change Owner Password
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="flex-1 rounded-xl border border-hairline bg-cream/30 px-3.5 py-2.5 text-sm outline-none focus:border-brand"
          />
          <Button variant="outline" loading={busy} disabled={!newPass} onClick={changePassword}>
            Update Password
          </Button>
        </div>
        {passMsg && <p className="mt-2 text-xs font-bold text-free-dark">{passMsg}</p>}
      </div>
    </Card>
  );
}
