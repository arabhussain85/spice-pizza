"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { formatRs } from "@/lib/money";
import { Button, Card, cn } from "@/components/ui";
import { ItemPhoto } from "@/components/ItemPhoto";
import { addModifier, deleteModifier, deleteMenuItem, toggleMenuItemLive, upsertMenuItem } from "../actions";

type Row = MenuItem & { menu_categories: { name: string; tab_group: string | null } | null };

export default function MenuAdminPage() {
  const supaRef = useRef(createClient());
  const [items, setItems] = useState<Row[]>([]);
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [mods, setMods] = useState<{ id: string; label: string }[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("All");
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supa = supaRef.current;
    try {
      const [itemsRes, catsRes, modsRes] = await Promise.all([
        supa.from("menu_items").select("*,menu_categories(name,tab_group)").is("deleted_at", null).order("sort_order"),
        supa.from("menu_categories").select("*").order("sort_order"),
        supa.from("menu_item_modifiers").select("id,label").is("menu_item_id", null).order("sort_order"),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      setItems((itemsRes.data ?? []) as unknown as Row[]);
      setCats((catsRes.data ?? []) as MenuCategory[]);
      setMods((modsRes.data ?? []) as { id: string; label: string }[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs = useMemo(() => {
    const set = new Set<string>();
    cats.forEach((c) => c.tab_group && set.add(c.tab_group));
    return ["All", ...set];
  }, [cats]);

  const visible = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (q && !it.name.toLowerCase().includes(q)) return false;
    if (tab !== "All" && it.menu_categories?.tab_group !== tab) return false;
    return true;
  });

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu</h1>
        <span className="text-sm text-muted">{items.length} items</span>
      </header>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items"
        className="mt-3 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand/50"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium",
              tab === t ? "border-brand bg-brand text-white" : "border-hairline bg-surface text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Button className="mt-3 w-full" onClick={() => setEditing({ is_live: true })}>
        + Add menu item
      </Button>

      {error && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {visible.map((it) => (
          <Card key={it.id} className="flex items-center gap-3 p-2.5">
            <ItemPhoto src={it.photo_url} alt={it.name} className="h-12 w-12 shrink-0 rounded-lg" />
            <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(it)}>
              <div className="truncate text-sm font-semibold">{it.name}</div>
              <div className="truncate text-xs text-muted">
                {it.menu_categories?.name}
                {it.size_label ? ` · ${it.size_label}` : ""}
              </div>
            </button>
            <div className="text-right">
              <div className="text-sm font-bold">{formatRs(it.price)}</div>
              <button
                onClick={async () => {
                  await toggleMenuItemLive(it.id, !it.is_live);
                  await load();
                }}
                className={cn("text-xs font-medium", it.is_live ? "text-free-dark" : "text-muted")}
              >
                {it.is_live ? "Live" : "Hidden"}
              </button>
            </div>
          </Card>
        ))}
        {items.length > 0 && visible.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">No items match.</div>
        )}
      </div>

      {/* quick-tag modifiers */}
      <Card className="mt-6 p-4">
        <h2 className="font-bold">Quick-tags (modifiers)</h2>
        <p className="text-xs text-muted">Shown on every item in the order builder.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mods.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-3 py-1.5 text-sm text-brand">
              {m.label}
              <button
                onClick={async () => {
                  await deleteModifier(m.id);
                  await load();
                }}
                className="text-brand/70 hover:text-brand"
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <AddModifier onAdd={load} />
      </Card>

      {editing && (
        <MenuItemSheet
          item={editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AddModifier({ onAdd }: { onAdd: () => Promise<void> }) {
  const [label, setLabel] = useState("");
  return (
    <div className="mt-3 flex gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Add quick-tag (e.g. No garlic)"
        className="flex-1 rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
      />
      <Button
        variant="soft"
        disabled={!label.trim()}
        onClick={async () => {
          await addModifier(label.trim());
          setLabel("");
          await onAdd();
        }}
      >
        Add
      </Button>
    </div>
  );
}

function MenuItemSheet({
  item,
  cats,
  onClose,
  onSaved,
}: {
  item: Partial<Row>;
  cats: MenuCategory[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name ?? "");
  const [price, setPrice] = useState(item.price != null ? String(item.price) : "");
  const [categoryId, setCategoryId] = useState(item.category_id ?? cats[0]?.id ?? "");
  const [size, setSize] = useState(item.size_label ?? "");
  const [photo, setPhoto] = useState(item.photo_url ?? "");
  const [live, setLive] = useState(item.is_live ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!item.id;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await upsertMenuItem({
        id: item.id,
        category_id: categoryId,
        name: name.trim(),
        price: Number(price),
        size_label: size.trim() || null,
        photo_url: photo.trim() || null,
        is_live: live,
        group_key: item.group_key ?? null,
      });
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" />
        <h3 className="text-lg font-bold">{isEdit ? "Edit menu item" : "Add menu item"}</h3>

        <div className="mt-4 flex gap-3">
          <ItemPhoto src={photo} alt={name} className="h-20 w-20 shrink-0 rounded-xl" />
          <div className="flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
              className="w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
            <input
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              placeholder="Photo URL"
              className="mt-2 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-xs outline-none focus:border-brand/50"
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Rs. price"
            className="rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Size (optional)"
            className="rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-2 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="mt-3 flex items-center justify-between">
          <span className="text-sm font-medium">Show on counter menu</span>
          <button
            onClick={() => setLive((v) => !v)}
            className={cn(
              "relative h-6 w-11 rounded-full transition",
              live ? "bg-brand" : "bg-hairline",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
                live ? "left-[22px]" : "left-0.5",
              )}
            />
          </button>
        </label>

        {err && <p className="mt-2 text-sm text-brand">{err}</p>}

        <div className="mt-4 flex gap-2">
          {isEdit && (
            <Button
              variant="outline"
              onClick={async () => {
                if (confirm("Delete this item?")) {
                  await deleteMenuItem(item.id!);
                  await onSaved();
                }
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" disabled={busy || !name || !price || !categoryId} onClick={save}>
            {busy ? "Saving…" : "Save item"}
          </Button>
        </div>
      </div>
    </div>
  );
}
