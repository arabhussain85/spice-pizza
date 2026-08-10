"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";


import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/Confirm";
import { createClient } from "@/lib/supabase/client";
import {
  fetchMenu,
  fetchOrderFull,
  type MenuCategoryWithProducts,
  type OrderFull,
  type RoundWithItems,
} from "@/lib/queries";
import type { MenuProduct, OrderLineItem } from "@/lib/types";
import { formatRs } from "@/lib/money";
import { formatClock, formatDuration } from "@/lib/time";
import { sumLines, billTotals } from "@/lib/order-math";
import { cn } from "@/components/ui";
import { ItemPhoto } from "@/components/ItemPhoto";
import { ItemModal, type AddSelection } from "./ItemModal";
import { CustomerCorner } from "./CustomerCorner";
import { LoadingScreen } from "@/components/Loader";
import { addLineItem, deleteLineItem, sendToKitchen } from "../../actions";
import { cancelOrder } from "@/app/admin/order-actions";

/** Live receipt: every round listed (sent = desaturated, current = editable). */
function RoundList({
  rounds,
  currentRoundId,
  onRemove,
}: {
  rounds: RoundWithItems[];
  currentRoundId: string | null;
  onRemove: (id: string) => void;
}) {
  const visible = rounds.filter(
    (r) => (r.order_line_items ?? []).some((li) => !li.is_voided) || r.id === currentRoundId,
  );
  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-[#605e5b] opacity-60">
        <span className="material-symbols-outlined text-4xl">receipt_long</span>
        <span className="text-sm">Tap items to start Round 1.</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {visible.map((r) => {
        const sent = !!r.sent_to_kitchen_at;
        const items = (r.order_line_items ?? []).filter((li) => !li.is_voided);
        return (
          <div key={r.id} className={cn(sent && "opacity-70")}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffe9e7] px-2.5 py-0.5 text-xs font-bold text-[#af101a]">
                <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                  {sent ? "check_circle" : "edit_note"}
                </span>
                Round {r.round_number}
              </span>
              <span className={cn("text-[11px] font-semibold", sent ? "text-[#2E7D32]" : "text-[#FFA000]")}>
                {sent ? `Sent ${formatClock(new Date(r.sent_to_kitchen_at!))}` : "Current · unsent"}
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map((li) => (
                <div key={li.id} className="flex items-start gap-2 rounded-lg border border-[#e4beba] bg-white px-3 py-2 shadow-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-[#ffe9e7] text-[11px] font-bold text-[#af101a]">
                    {li.quantity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight text-[#1A1A1A]">
                      {li.name_snapshot}
                      {li.size_snapshot ? ` (${li.size_snapshot})` : ""}
                    </div>
                    {(li.note || li.modifiers.length > 0) && (
                      <div className="text-xs text-[#605e5b]">{[li.note, ...li.modifiers].filter(Boolean).join(", ")}</div>
                    )}
                  </div>
                  <div className="text-right text-sm font-bold tabular-nums text-[#1A1A1A]">
                    {formatRs(li.unit_price * li.quantity)}
                  </div>
                  {!sent && (
                    <button onClick={() => onRemove(li.id)} className="ml-0.5 text-[#8f6f6c] hover:text-[#af101a]" aria-label="remove">
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                    </button>
                  )}
                </div>
              ))}
              {items.length === 0 && r.id === currentRoundId && (
                <div className="rounded-lg border border-dashed border-[#e4beba] px-3 py-3 text-center text-xs text-[#605e5b]">
                  No items yet — tap the menu to add to Round {r.round_number}.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OrderBuilder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { prompt, notify } = useConfirm();
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
  const currentItems: OrderLineItem[] = currentRound?.order_line_items?.filter((li) => !li.is_voided) ?? [];
  const allLines = rounds.flatMap((r) => r.order_line_items);
  const totals = billTotals(allLines, order?.order.service_charge_pct ?? 5);
  const roundSubtotal = sumLines(currentItems);
  const roundNumber = currentRound?.round_number ?? (rounds.at(-1)?.round_number ?? 1);
  const totalItems = allLines.filter((li) => !li.is_voided).reduce((a, li) => a + li.quantity, 0);

  const visibleProducts: MenuProduct[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    // extra topping is added inside the pizza popup, so hide its standalone card
    const notTopping = (p: MenuProduct) => p.group_key !== "extra-topping";
    if (q) return menu.flatMap((c) => c.products).filter((p) => notTopping(p) && p.name.toLowerCase().includes(q));
    return (menu.find((c) => c.category.id === activeCat)?.products ?? []).filter(notTopping);
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
    if (sel.extraTopping && sel.extraTopping.quantity > 0) {
      const t = sel.extraTopping.variant;
      await addLineItem(orderId, {
        menuItemId: t.id,
        name: t.name,
        size: t.size_label,
        unitPrice: t.price,
        quantity: sel.extraTopping.quantity,
        note: null,
        modifiers: [],
      });
    }
    await refetchOrder();
  }
  const removeItem = useCallback(async (id: string) => { await deleteLineItem(id); await refetchOrder(); }, [refetchOrder]);

  async function handleSend() {
    // Open a single print window synchronously inside the click handler to avoid popup blocking.
    const printWin = window.open("about:blank", "_blank");

    setSending(true);
    setBanner(null);
    try {
      const res = await sendToKitchen(orderId);
      if (!res.ok) {
        printWin?.close();
        setBanner(res.error);
        return;
      }
      // Round 1 prints kitchen slip + bill slip. Round 2+ only prints kitchen slip.
      if (printWin) {
        if (res.roundNumber > 1) {
          printWin.location.href = `/api/print/kitchen/${res.roundId}/html`;
        } else {
          printWin.location.href = `/api/print/round/${res.roundId}/html`;
        }
      }

      await refetchOrder();
      setCartOpen(false);
    } finally {
      setSending(false);
    }
  }

  if (!order) return <div className="min-h-screen bg-[#FCF9F5]"><LoadingScreen label="Loading order…" /></div>;

  const table = order.table;
  const otype = order.order.order_type ?? "dine_in";
  const typeNo = order?.order.type_number ?? null;
  const token = order?.order.token_number ?? null;
  const headline =
    otype === "takeaway"
      ? `Takeaway${typeNo != null ? ` #${typeNo}` : ""}`
      : otype === "delivery"
        ? `Delivery${typeNo != null ? ` #${typeNo}` : ""}`
        : `Table ${table?.number ?? "—"}`;
  const custName = order?.order.customer_name ?? null;

  return (
    <div className="h-screen flex flex-col bg-[#FCF9F5] overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Top Header ──────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-20 h-14 flex items-center justify-between px-4 md:px-8 bg-[#fff8f7] border-b border-[#e4beba] shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/counter")} className="flex items-center gap-1.5 text-[#605e5b] hover:text-[#af101a] transition-colors text-sm font-semibold">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
            Tables
          </button>
          <div className="w-px h-5 bg-[#e4beba]" />
          <div>
            <div className="text-base font-bold text-[#1A1A1A] leading-tight">{headline}</div>
            <div className="text-xs text-[#605e5b]">
              Round {roundNumber}
              {token != null ? ` · Token #${token}` : ""}
              {otype === "dine_in" && table?.opened_at
                ? ` · Occupied ${formatDuration(table.opened_at, now)}`
                : custName
                  ? ` · ${custName}`
                  : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8f6f6c]" style={{ fontSize: "16px" }}>search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" className="pl-9 pr-4 py-2 w-44 rounded-xl border border-[#e4beba] bg-white/80 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a] transition-colors" />
          </div>
          <button onClick={() => router.push(`/counter/order/${orderId}/bill`)} className="flex items-center gap-1.5 bg-[#ffe9e7] text-[#af101a] text-xs font-semibold px-4 h-10 rounded-xl border border-[#e4beba] hover:bg-[#ffe2de] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>receipt_long</span>
            View bill
          </button>
          <button
            onClick={async () => {
              const pin = await prompt({
                title: "Cancel this order?",
                message: "Nothing is charged and any table is freed. Enter the owner PIN to confirm.",
                inputLabel: "Owner PIN",
                placeholder: "PIN",
                required: true,
                confirmLabel: "Cancel order",
                cancelLabel: "Keep order",
                danger: true,
              });
              if (!pin) return;
              const res = await cancelOrder(orderId, { pin });
              if (!res.ok) {
                await notify({ title: "Not cancelled", message: res.error, danger: true });
                return;
              }
              router.push("/counter");
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-[#e4beba] px-3 text-xs font-semibold text-[#605e5b] transition-colors hover:border-[#af101a]/40 hover:text-[#af101a]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>cancel</span>
            Cancel
          </button>
        </div>
      </header>

      {/* ── Main: Menu + Receipt ────────────────────────────── */}
      <div className="flex flex-1 pt-14 overflow-hidden">
        {/* Menu Panel (Split layout: Categories Sidebar on left, Products Grid on right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Categories Sidebar */}
          {!search && (
            <div className="w-32 md:w-44 shrink-0 border-r border-[#e4beba] bg-white/40 p-3 md:p-4 overflow-y-auto overscroll-contain flex flex-col gap-2 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8f6f6c] mb-1 px-1">Categories</div>
              {menu.filter((c) => c.products.length && c.category.name !== "Add-ons").map((c) => (
                <button
                  key={c.category.id}
                  onClick={() => setActiveCat(c.category.id)}
                  className={cn(
                    "w-full text-left rounded-xl border px-3 py-3 text-xs md:text-sm font-semibold transition-all leading-snug",
                    c.category.id === activeCat 
                      ? "border-[#af101a] bg-[#af101a] text-white shadow-sm font-bold" 
                      : "border-[#e4beba] bg-white text-[#605e5b] hover:border-[#af101a]/40 hover:bg-[#ffe9e7]/10",
                  )}
                >
                  {c.category.name}
                </button>
              ))}
            </div>
          )}

          {/* Products Column */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="sm:hidden relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8f6f6c]" style={{ fontSize: "16px" }}>search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-[#e4beba] bg-white text-sm text-[#1A1A1A] outline-none focus:border-[#af101a]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleProducts.map((p) => {
                const minPrice = p.variants[0]?.price ?? 0;
                const multi = p.variants.length > 1;
                return (
                  <button key={p.group_key} onClick={() => setModalProduct(p)} className="group flex flex-col overflow-hidden rounded-xl border border-[#e4beba] bg-white text-left shadow-sm hover:border-[#af101a]/40 hover:shadow-md transition-all active:scale-[0.97]">
                    <ItemPhoto src={p.photo_url} alt={p.name} className="h-24 w-full" />
                    <div className="flex flex-col flex-1 p-3">
                      <div className="text-sm font-semibold text-[#1A1A1A] line-clamp-2">{p.name}</div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="text-sm font-bold text-[#af101a]">{multi ? "from " : ""}{formatRs(minPrice)}</span>
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#af101a] text-white text-lg font-bold shadow-sm group-hover:bg-[#8b0d14] transition-colors">+</span>
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
        </div>

        {/* ── Live Receipt Panel (Desktop) ─────────────────── */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 bg-[#fff0ef] border-l border-[#e4beba] shadow-panel overflow-hidden">
          <div className="p-5 border-b border-[#e4beba] flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#1A1A1A]">Live Receipt</h2>
              <div className="text-xs text-[#605e5b]">{headline} · #{order?.order.order_number?.replace(/^SP-/, "") ?? ""}</div>
            </div>
            <span className="text-xs font-semibold text-[#605e5b] bg-white px-2.5 py-1 rounded-full border border-[#e4beba]">{totalItems} items</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <RoundList rounds={rounds} currentRoundId={currentRound?.id ?? null} onRemove={removeItem} />
          </div>

          {banner && (
            <div className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-[#ffe2de] px-4 py-2.5 text-xs text-[#af101a] border border-[#e4beba]">
              <span>{banner}</span>
              <button onClick={handleSend} className="font-bold underline ml-2">Retry</button>
            </div>
          )}

          <div className="p-4 border-t border-[#e4beba] bg-white/60 space-y-1.5">
            <div className="flex justify-between text-sm text-[#605e5b]"><span>Subtotal</span><span className="tabular-nums">{formatRs(totals.subtotal)}</span></div>
            <div className="flex justify-between text-sm text-[#605e5b]"><span>Service charge ({order?.order.service_charge_pct ?? 5}%)</span><span className="tabular-nums">{formatRs(totals.service)}</span></div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-[#1A1A1A]">Total</span>
              <span className="text-2xl font-bold text-[#af101a]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{formatRs(totals.total)}</span>
            </div>
            <button
              disabled={currentItems.length === 0 || sending}
              onClick={handleSend}
              className="mt-3 w-full h-12 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-bold rounded-xl hover:bg-[#8b0d14] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.97]"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>send</span>
              {sending ? "Sending…" : currentItems.length === 0 ? `Add items for Round ${roundNumber}` : `Send Round ${roundNumber} → Kitchen`}
            </button>
            <p className="pt-1 text-center text-[11px] text-[#8f6f6c]">Sending prints the kitchen slip &amp; opens the next round.</p>
          </div>
        </aside>
      </div>

      {/* ── Mobile FAB ─────────────────────────────────────── */}
      {totalItems > 0 && (
        <button className="lg:hidden fixed bottom-6 right-5 z-20 flex items-center gap-2 bg-[#af101a] text-white text-sm font-bold px-5 h-14 rounded-2xl shadow-[0_4px_20px_rgba(175,16,26,0.35)] active:scale-[0.97] transition-transform" onClick={() => setCartOpen(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>receipt_long</span>
          {totalItems} · {formatRs(totals.total)}
        </button>
      )}

      {/* ── Mobile Receipt Sheet ───────────────────────────── */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[#FCF9F5] rounded-t-3xl shadow-modal max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#e4beba]" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e4beba]">
              <div className="font-bold text-[#1A1A1A]">Live Receipt · {totalItems} items</div>
              <button onClick={() => setCartOpen(false)} className="text-[#605e5b] hover:text-[#af101a]"><span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4"><RoundList rounds={rounds} currentRoundId={currentRound?.id ?? null} onRemove={removeItem} /></div>
            <div className="p-5 border-t border-[#e4beba] bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#605e5b]">Total ({order?.order.service_charge_pct ?? 5}% svc)</span>
                <span className="text-xl font-bold text-[#af101a]">{formatRs(totals.total)}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setCartOpen(false); router.push(`/counter/order/${orderId}/bill`); }} className="flex-1 h-12 flex items-center justify-center gap-2 bg-white text-[#af101a] text-sm font-semibold rounded-xl border border-[#e4beba] hover:bg-[#ffe9e7]">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>receipt_long</span>
                  View Bill
                </button>
                <button disabled={currentItems.length === 0 || sending} onClick={handleSend} className="flex-1 h-12 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-bold rounded-xl hover:bg-[#8b0d14] transition-colors disabled:opacity-50 shadow-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>send</span>
                  {sending ? "Sending…" : `Send R${roundNumber}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {otype !== "dine_in" && order && (
        <CustomerCorner
          orderId={orderId}
          type={otype as "takeaway" | "delivery"}
          initial={{
            name: order.order.customer_name,
            phone: order.order.customer_phone,
            address: order.order.customer_address,
          }}
        />
      )}

      {modalProduct && (() => {
        const cat = menu.find((c) => c.category.id === modalProduct.category_id)?.category;
        const isPizza = cat?.tab_group === "Pizza" && cat.name !== "Add-ons" && modalProduct.group_key !== "extra-topping";
        const topping = isPizza
          ? menu.flatMap((c) => c.products).find((p) => p.group_key === "extra-topping")
          : undefined;
        return (
          <ItemModal
            product={modalProduct}
            modifiers={modifiers}
            extraToppingVariants={topping?.variants}
            onCancel={() => setModalProduct(null)}
            onAdd={handleAdd}
          />
        );
      })()}
    </div>
  );
}
