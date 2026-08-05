"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchMenu } from "@/lib/queries";
import type { Promotion } from "@/lib/promotions";
import type { MenuCategory } from "@/lib/types";
import { Card } from "@/components/ui";
import { createPromotion, deletePromotion, setPromotionActive } from "../promo-actions";

interface ProductRef {
  group_key: string;
  name: string;
}

export function PromotionsManager() {
  const supaRef = useRef(createClient());
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [scope, setScope] = useState<"all" | "category" | "item">("all");
  const [categoryId, setCategoryId] = useState("");
  const [groupKey, setGroupKey] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = useCallback(async () => {
    const supa = supaRef.current;
    try {
      const [{ data: p, error: pe }, menu] = await Promise.all([
        supa.from("promotions").select("*").order("created_at", { ascending: false }),
        fetchMenu(supa, { liveOnly: false }),
      ]);
      if (pe) throw pe;
      setPromos((p ?? []) as Promotion[]);
      setCats(menu.map((c) => c.category));
      setProducts(menu.flatMap((c) => c.products).map((pr) => ({ group_key: pr.group_key, name: pr.name })));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!name.trim() || !value) return;
    setBusy(true);
    setError(null);
    try {
      await createPromotion({
        name: name.trim(),
        type,
        value: Number(value),
        scope,
        category_id: scope === "category" ? categoryId || null : null,
        group_key: scope === "item" ? groupKey || null : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      });
      setName("");
      setValue("");
      setEndsAt("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const scopeLabel = (p: Promotion) =>
    p.scope === "all"
      ? "Whole menu"
      : p.scope === "category"
        ? `Category: ${cats.find((c) => c.id === p.category_id)?.name ?? "—"}`
        : `Item: ${products.find((x) => x.group_key === p.group_key)?.name ?? "—"}`;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#af101a]">campaign</span>
            Promotions
          </h2>
          <p className="text-xs text-[#605e5b]">Create discounts (e.g. “Anniversary 20%”) on the whole menu, a category, or one item — auto-applied to bills.</p>
        </div>
        {promos.filter((p) => p.is_active).length > 0 && (
          <span className="rounded-full bg-[#e8f5e9] px-2.5 py-1 text-xs font-semibold text-[#2E7D32]">
            {promos.filter((p) => p.is_active).length} active
          </span>
        )}
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {/* create form */}
      <div className="rounded-xl border border-[#e4beba] bg-[#fff0ef] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Promotion name (e.g. Anniversary)"
            className="sm:col-span-2 h-10 rounded-lg border border-[#e4beba] bg-white px-3 text-sm outline-none focus:border-[#af101a]"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? "20" : "100"}
              className="h-10 w-full rounded-lg border border-[#e4beba] bg-white px-3 text-sm outline-none focus:border-[#af101a]"
            />
            <div className="flex rounded-lg border border-[#e4beba] overflow-hidden">
              {(["percent", "fixed"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={"px-3 text-sm font-semibold " + (type === t ? "bg-[#af101a] text-white" : "bg-white text-[#605e5b]")}
                >
                  {t === "percent" ? "%" : "Rs"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="h-10 rounded-lg border border-[#e4beba] bg-white px-3 text-sm outline-none focus:border-[#af101a]">
            <option value="all">Whole menu</option>
            <option value="category">A category</option>
            <option value="item">A specific item</option>
          </select>
          {scope === "category" && (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:col-span-2 h-10 rounded-lg border border-[#e4beba] bg-white px-3 text-sm outline-none focus:border-[#af101a]">
              <option value="">Select category…</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {scope === "item" && (
            <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className="sm:col-span-2 h-10 rounded-lg border border-[#e4beba] bg-white px-3 text-sm outline-none focus:border-[#af101a]">
              <option value="">Select item…</option>
              {products.map((p) => (
                <option key={p.group_key} value={p.group_key}>{p.name}</option>
              ))}
            </select>
          )}
          {scope === "all" && (
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              title="Optional end date"
              className="sm:col-span-2 h-10 rounded-lg border border-[#e4beba] bg-white px-3 text-sm text-[#605e5b] outline-none focus:border-[#af101a]"
            />
          )}
        </div>

        <button
          onClick={submit}
          disabled={busy || !name.trim() || !value || (scope === "category" && !categoryId) || (scope === "item" && !groupKey)}
          className="w-full h-11 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-bold rounded-xl hover:bg-[#8b0d14] transition-colors disabled:opacity-50 shadow-sm active:scale-[0.98]"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
          {busy ? "Creating…" : "Create promotion"}
        </button>
      </div>

      {/* list */}
      <div className="mt-4 space-y-2">
        {promos.map((p) => (
          <div key={p.id} className={"flex items-center justify-between rounded-lg border border-[#e4beba] bg-white px-4 py-3 " + (p.is_active ? "" : "opacity-60")}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#1A1A1A]">{p.name}</span>
                <span className="rounded-full bg-[#ffe9e7] px-2 py-0.5 text-xs font-bold text-[#af101a]">
                  {p.type === "percent" ? `${p.value}%` : `Rs. ${p.value}`} off
                </span>
              </div>
              <div className="text-xs text-[#605e5b]">
                {scopeLabel(p)}
                {p.ends_at ? ` · until ${new Date(p.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => { await setPromotionActive(p.id, !p.is_active); await load(); }}
                className={"text-xs font-bold " + (p.is_active ? "text-[#2E7D32]" : "text-[#605e5b]")}
              >
                {p.is_active ? "Active" : "Paused"}
              </button>
              <button
                onClick={async () => { if (confirm(`Delete promotion “${p.name}”?`)) { await deletePromotion(p.id); await load(); } }}
                className="text-[#8f6f6c] hover:text-[#af101a]"
                aria-label="delete"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
              </button>
            </div>
          </div>
        ))}
        {promos.length === 0 && !error && (
          <div className="py-6 text-center text-sm text-[#605e5b]">No promotions yet — create one above.</div>
        )}
      </div>
    </Card>
  );
}
