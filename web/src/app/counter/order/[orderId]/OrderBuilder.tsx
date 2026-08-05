"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchMenu, fetchOrderFull, type MenuCategoryWithProducts, type OrderFull } from "@/lib/queries";
import type { MenuProduct, OrderLineItem } from "@/lib/types";
import { formatRs } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { sumLines } from "@/lib/order-math";
import { cn } from "@/components/ui";
import { ItemPhoto } from "@/components/ItemPhoto";
import { ItemModal, type AddSelection } from "./ItemModal";
import { addLineItem, deleteLineItem, sendToKitchen } from "../../actions";

export function OrderBuilder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const supaRef = useRef(createClient());
  const [menu, setMenu] = useState<MenuCategoryWithProducts[]>([]);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [order, setOrder] = useState<OrderFull | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalProduct, setModalProduct] = useState<MenuProduct | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const refetchOrder = useCallback(async () => {
    const data = await fetchOrderFull(supaRef.current, orderId);
    setOrder(data);
  }, [orderId]);

  useEffect(() => {
    const supa = supaRef.current;
    (async () => {
      const [menuData, modsRes] = await Promise.all([
        fetchMenu(supa, { liveOnly: true }),
        supa.from("menu_item_modifiers").select("label").is("menu_item_id", null).order("sort_order"),
      ]);
      setMenu(menuData);
      setModifiers(((modsRes.data ?? []) as { label: string }[]).map((m) => m.label));
      setActiveCat((prev) => prev ?? menuData.find((c) => c.products.length)?.category.id ?? null);
      await refetchOrder();
    })();

    const channel = supa
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_rounds", filter: `order_id=eq.${orderId}` }, refetchOrder)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_line_items" }, refetchOrder)
      .subscribe();
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => {
      supa.removeChannel(channel);
      clearInterval(tick);
    };
  }, [orderId, refetchOrder]);

  const rounds = order?.rounds ?? [];
  const currentRound = useMemo(() => [...rounds].reverse().find((r) => !r.sent_to_kitchen_at) ?? null, [rounds]);
  const sentRounds = rounds.filter((r) => r.sent_to_kitchen_at);
  const currentItems: OrderLineItem[] = currentRound?.order_line_items ?? [];
  const sentItems = sentRounds.flatMap((r) => r.order_line_items);
  const sentTotal = sumLines(sentItems);
  const roundSubtotal = sumLines(currentItems);
  const roundNumber = currentRound?.round_number ?? (rounds.at(-1)?.round_number ?? 1);

  const visibleProducts: MenuProduct[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return menu.flatMap((c) => c.products).filter((p) => p.name.toLowerCase().includes(q));
    return menu.find((c) => c.category.id === activeCat)?.products ?? [];
  }, [menu, activeCat, search]);

  async function handleAdd(sel: AddSelection) {
    setModalProduct(null);
    await addLineItem(orderId, {
      menuItemId: sel.variant.id,
      name: sel.variant.name,
      size: sel.variant.size_label,
      unitPrice: sel.variant.price,
      quantity: sel.quantity,
      note: sel.note || null,
      modifiers: sel.modifiers,
    });
    await refetchOrder();
  }

  async function handleSend() {
    setSending(true);
    setBanner(null);
    try {
      const res = await sendToKitchen(orderId);
      if (!res.ok) {
        setBanner(res.error);
        return;
      }
      try {
        window.open(`/api/print/round/${res.roundId}`, "_blank");
      } catch {
        setBanner("Printer offline — slip saved, open the bill to reprint.");
      }
      await refetchOrder();
      setCartOpen(false);
    } finally {
      setSending(false);
    }
  }

  const table = order?.table;

  return (
    <div className="min-h-screen flex flex-col bg-[#FCF9F5]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Top Header ──────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-20 h-14 flex items-center justify-between px-4 md:px-8 bg-[#fff8f7] border-b border-[#e4beba] shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/counter")}
            className="flex items-center gap-1.5 text-[#605e5b] hover:text-[#af101a] transition-colors text-sm font-semibold"
          >
            <span className="material-symbols-outlined" style={{fontSize:'20px'}}>arrow_back</span>
            Tables
          </button>
          <div className="w-px h-5 bg-[#e4beba]" />
          <div>
            <div className="text-base font-bold text-[#1A1A1A] leading-tight">Table {table?.number ?? "—"}</div>
            <div className="text-xs text-[#605e5b]">
              Round {roundNumber}
              {table?.opened_at ? ` · Occupied ${formatDuration(table.opened_at, now)}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8f6f6c]" style={{fontSize:'16px'}}>search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="pl-9 pr-4 py-2 w-44 rounded-xl border border-[#e4beba] bg-white/80 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a] transition-colors"
            />
          </div>
          <button
            onClick={() => router.push(`/counter/order/${orderId}/bill`)}
            className="flex items-center gap-1.5 bg-[#ffe9e7] text-[#af101a] text-xs font-semibold px-4 h-10 rounded-xl border border-[#e4beba] hover:bg-[#ffe2de] transition-colors"
          >
            <span className="material-symbols-outlined" style={{fontSize:'18px'}}>receipt_long</span>
            View bill
          </button>
        </div>
      </header>

      {/* ── Main: Menu + Cart ───────────────────────────────── */}
      <div className="flex flex-1 pt-14 overflow-hidden" style={{height:'100vh'}}>
        {/* Menu Panel */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Mobile search */}
          <div className="sm:hidden relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8f6f6c]" style={{fontSize:'16px'}}>search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-[#e4beba] bg-white text-sm text-[#1A1A1A] outline-none focus:border-[#af101a]"
            />
          </div>

          {/* Category Tabs */}
          {!search && (
            <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
              {menu.filter((c) => c.products.length).map((c) => (
                <button
                  key={c.category.id}
                  onClick={() => setActiveCat(c.category.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                    c.category.id === activeCat
                      ? "border-[#af101a] bg-[#af101a] text-white shadow-sm"
                      : "border-[#e4beba] bg-white text-[#605e5b] hover:border-[#af101a]/40"
                  )}
                >
                  {c.category.name}
                </button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
            {visibleProducts.map((p) => {
              const minPrice = p.variants[0]?.price ?? 0;
              const multi = p.variants.length > 1;
              return (
                <button
                  key={p.group_key}
                  onClick={() => setModalProduct(p)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#e4beba] bg-white text-left shadow-sm hover:border-[#af101a]/40 hover:shadow-md transition-all active:scale-[0.97]"
                >
                  <ItemPhoto src={p.photo_url} alt={p.name} className="h-24 w-full" />
                  <div className="flex flex-col flex-1 p-3">
                    <div className="text-sm font-semibold text-[#1A1A1A] line-clamp-2">{p.name}</div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-sm font-bold text-[#af101a]">
                        {multi ? "from " : ""}{formatRs(minPrice)}
                      </span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#af101a] text-white text-lg font-bold shadow-sm group-hover:bg-[#8b0d14] transition-colors">
                        +
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            {visibleProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-[#605e5b]">
                <span className="material-symbols-outlined text-4xl text-[#e4beba] block mb-2">search_off</span>
                No items found.
              </div>
            )}
          </div>
        </div>

        {/* ── Cart Panel (Desktop) ─────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 bg-[#fff0ef] border-l border-[#e4beba] shadow-panel overflow-y-auto">
          <div className="p-5 border-b border-[#e4beba]">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1A1A1A]">This Round</h2>
              <span className="text-xs font-semibold text-[#605e5b] bg-white px-2.5 py-1 rounded-full border border-[#e4beba]">
                {currentItems.length} {currentItems.length === 1 ? "item" : "items"}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {currentItems.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-[#605e5b] opacity-60">
                <span className="material-symbols-outlined text-4xl">shopping_cart</span>
                <span className="text-sm">Tap items to add them here.</span>
              </div>
            )}
            {currentItems.map((li) => (
              <div key={li.id} className="flex items-start gap-2 bg-white rounded-xl p-3 border border-[#e4beba] shadow-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#ffe9e7] text-[11px] font-bold text-[#af101a] mt-0.5">
                  {li.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1A1A1A] leading-tight">
                    {li.name_snapshot}
                    {li.size_snapshot ? ` (${li.size_snapshot})` : ""}
                  </div>
                  {(li.note || li.modifiers.length > 0) && (
                    <div className="text-xs text-[#605e5b]">
                      {[li.note, ...li.modifiers].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm font-bold text-[#1A1A1A] tabular-nums">
                  {formatRs(li.unit_price * li.quantity)}
                </div>
                <button
                  onClick={async () => { await deleteLineItem(li.id); await refetchOrder(); }}
                  className="text-[#8f6f6c] hover:text-[#af101a] transition-colors ml-0.5"
                  aria-label="remove"
                >
                  <span className="material-symbols-outlined" style={{fontSize:'16px'}}>close</span>
                </button>
              </div>
            ))}
          </div>

          {sentTotal > 0 && (
            <div className="mx-4 mb-3 rounded-xl bg-white/80 px-4 py-2.5 text-xs text-[#605e5b] border border-[#e4beba]">
              Already sent to kitchen:{" "}
              <span className="font-bold text-[#1A1A1A]">{formatRs(sentTotal)}</span>
            </div>
          )}

          {banner && (
            <div className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-[#ffe2de] px-4 py-2.5 text-xs text-[#af101a] border border-[#e4beba]">
              <span>{banner}</span>
              <button onClick={handleSend} className="font-bold underline ml-2">Retry</button>
            </div>
          )}

          <div className="p-4 border-t border-[#e4beba]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#605e5b]">Round subtotal</span>
              <span className="text-2xl font-bold text-[#1A1A1A]" style={{fontFamily:"'Hanken Grotesk', sans-serif"}}>
                {formatRs(roundSubtotal)}
              </span>
            </div>
            <button
              disabled={currentItems.length === 0 || sending}
              onClick={handleSend}
              className="w-full h-12 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-bold rounded-xl hover:bg-[#8b0d14] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.97]"
            >
              <span className="material-symbols-outlined" style={{fontSize:'20px'}}>send</span>
              {sending ? "Sending to Kitchen…" : "Send to Kitchen"}
            </button>
          </div>
        </aside>
      </div>

      {/* ── Mobile FAB Cart ────────────────────────────────── */}
      {currentItems.length > 0 && (
        <button
          className="lg:hidden fixed bottom-6 right-5 z-20 flex items-center gap-2 bg-[#af101a] text-white text-sm font-bold px-5 h-14 rounded-2xl shadow-[0_4px_20px_rgba(175,16,26,0.35)] active:scale-[0.97] transition-transform"
          onClick={() => setCartOpen(true)}
        >
          <span className="material-symbols-outlined" style={{fontSize:'22px'}}>shopping_cart</span>
          {currentItems.length} items · {formatRs(roundSubtotal)}
        </button>
      )}

      {/* ── Mobile Cart Sheet ──────────────────────────────── */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-[#FCF9F5] rounded-t-3xl shadow-modal max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#e4beba]" />
            </div>
            {/* Sheet Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e4beba]">
              <div className="font-bold text-[#1A1A1A]">
                This Round · {currentItems.length} items
              </div>
              <button onClick={() => setCartOpen(false)} className="text-[#605e5b] hover:text-[#af101a]">
                <span className="material-symbols-outlined" style={{fontSize:'22px'}}>close</span>
              </button>
            </div>
            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {currentItems.map((li) => (
                <div key={li.id} className="flex items-start gap-2 bg-white rounded-xl p-3 border border-[#e4beba]">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#ffe9e7] text-[11px] font-bold text-[#af101a]">
                    {li.quantity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1A1A1A]">
                      {li.name_snapshot}{li.size_snapshot ? ` (${li.size_snapshot})` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{formatRs(li.unit_price * li.quantity)}</div>
                  <button onClick={async () => { await deleteLineItem(li.id); await refetchOrder(); }} className="text-[#8f6f6c] hover:text-[#af101a]">
                    <span className="material-symbols-outlined" style={{fontSize:'16px'}}>close</span>
                  </button>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="p-5 border-t border-[#e4beba] bg-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[#605e5b]">Round subtotal</span>
                <span className="text-xl font-bold">{formatRs(roundSubtotal)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCartOpen(false); router.push(`/counter/order/${orderId}/bill`); }}
                  className="flex-1 h-12 flex items-center justify-center gap-2 bg-white text-[#af101a] text-sm font-semibold rounded-xl border border-[#e4beba] hover:bg-[#ffe9e7]"
                >
                  <span className="material-symbols-outlined" style={{fontSize:'18px'}}>receipt_long</span>
                  View Bill
                </button>
                <button
                  disabled={currentItems.length === 0 || sending}
                  onClick={handleSend}
                  className="flex-1 h-12 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-bold rounded-xl hover:bg-[#8b0d14] transition-colors disabled:opacity-50 shadow-sm"
                >
                  <span className="material-symbols-outlined" style={{fontSize:'18px'}}>send</span>
                  {sending ? "Sending…" : "Send to Kitchen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {modalProduct && (
        <ItemModal
          product={modalProduct}
          modifiers={modifiers}
          onCancel={() => setModalProduct(null)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
