"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchMenu, fetchOrderFull, type MenuCategoryWithProducts, type OrderFull } from "@/lib/queries";
import type { MenuProduct, OrderLineItem } from "@/lib/types";
import { formatRs } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { sumLines } from "@/lib/order-math";
import { Button, Pill, cn } from "@/components/ui";
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

  // derived round state
  const rounds = order?.rounds ?? [];
  const currentRound = useMemo(() => [...rounds].reverse().find((r) => !r.sent_to_kitchen_at) ?? null, [rounds]);
  const sentRounds = rounds.filter((r) => r.sent_to_kitchen_at);
  const currentItems: OrderLineItem[] = currentRound?.order_line_items ?? [];
  const sentItems = sentRounds.flatMap((r) => r.order_line_items);
  const sentTotal = sumLines(sentItems);
  const roundSubtotal = sumLines(currentItems);
  const roundNumber = currentRound?.round_number ?? (rounds.at(-1)?.round_number ?? 1);
  const sentRange =
    sentRounds.length > 0
      ? `rounds ${sentRounds[0].round_number}–${sentRounds.at(-1)!.round_number}`
      : "";

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
      // v1: open the printable slips (kitchen + counter) as one PDF
      try {
        window.open(`/api/print/round/${res.roundId}`, "_blank");
      } catch {
        setBanner("Printer offline — slip saved, open the bill to reprint.");
      }
      await refetchOrder();
    } finally {
      setSending(false);
    }
  }

  const table = order?.table;

  return (
    <div>
      {/* top bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/counter")} className="px-3 py-1.5">
            ← Tables
          </Button>
          <div>
            <div className="text-lg font-bold leading-tight">Table {table?.number ?? "—"}</div>
            <div className="text-xs text-muted">
              Round {roundNumber}
              {table?.opened_at ? ` · Occupied ${formatDuration(table.opened_at, now)}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu"
            className="w-44 rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <Button variant="soft" onClick={() => router.push(`/counter/order/${orderId}/bill`)}>
            View bill
          </Button>
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        {/* menu */}
        <div className="flex-1">
          {!search && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {menu
                .filter((c) => c.products.length)
                .map((c) => (
                  <button
                    key={c.category.id}
                    onClick={() => setActiveCat(c.category.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
                      c.category.id === activeCat
                        ? "border-brand bg-brand text-white"
                        : "border-hairline bg-surface text-ink hover:border-brand/40",
                    )}
                  >
                    {c.category.name}
                  </button>
                ))}
            </div>
          )}

          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleProducts.map((p) => {
              const minPrice = p.variants[0]?.price ?? 0;
              const multi = p.variants.length > 1;
              return (
                <button
                  key={p.group_key}
                  onClick={() => setModalProduct(p)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface text-left shadow-sm transition hover:border-brand/40"
                >
                  <ItemPhoto src={p.photo_url} alt={p.name} className="h-24 w-full" />
                  <div className="flex flex-1 flex-col p-3">
                    <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-sm font-bold text-brand">
                        {multi ? "from " : ""}
                        {formatRs(minPrice)}
                      </span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white">+</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {visibleProducts.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-muted">No items found.</div>
            )}
          </div>
        </div>

        {/* this round panel */}
        <aside className="lg:w-80 lg:shrink-0">
          <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-sm lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">This round</h2>
              <span className="text-xs text-muted">
                {currentItems.length} {currentItems.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="mt-3 max-h-[46vh] space-y-3 overflow-y-auto">
              {currentItems.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">Tap items to add them here.</p>
              )}
              {currentItems.map((li) => (
                <div key={li.id} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-brand-tint text-[11px] font-semibold text-brand">
                    {li.quantity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight">
                      {li.name_snapshot}
                      {li.size_snapshot ? ` (${li.size_snapshot})` : ""}
                    </div>
                    {(li.note || li.modifiers.length > 0) && (
                      <div className="text-xs text-muted">
                        {[li.note, ...li.modifiers].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums">
                    {formatRs(li.unit_price * li.quantity)}
                  </div>
                  <button
                    onClick={async () => {
                      await deleteLineItem(li.id);
                      await refetchOrder();
                    }}
                    className="ml-1 text-muted hover:text-brand"
                    aria-label="remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {sentTotal > 0 && (
              <div className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-muted">
                Already sent to kitchen: <span className="font-semibold text-ink">{formatRs(sentTotal)}</span>{" "}
                ({sentRange})
              </div>
            )}

            {banner && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-tint px-3 py-2 text-xs text-brand">
                <span>{banner}</span>
                <button onClick={handleSend} className="font-semibold underline">
                  Retry
                </button>
              </div>
            )}

            <div className="mt-4 border-t border-hairline pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Round subtotal</span>
                <span className="text-xl font-bold">{formatRs(roundSubtotal)}</span>
              </div>
              <Button
                variant="primary"
                className="mt-3 w-full py-3 text-base"
                disabled={currentItems.length === 0 || sending}
                onClick={handleSend}
              >
                {sending ? "Sending…" : "Send to Kitchen"}
              </Button>
            </div>
          </div>
        </aside>
      </div>

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
