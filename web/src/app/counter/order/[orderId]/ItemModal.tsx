"use client";

import { useState } from "react";
import type { MenuItem, MenuProduct } from "@/lib/types";
import { formatRs } from "@/lib/money";
import { Button, cn } from "@/components/ui";
import { ItemPhoto } from "@/components/ItemPhoto";

export interface AddSelection {
  variant: MenuItem;
  quantity: number;
  note: string;
  modifiers: string[];
}

export function ItemModal({
  product,
  modifiers,
  onCancel,
  onAdd,
}: {
  product: MenuProduct;
  modifiers: string[];
  onCancel: () => void;
  onAdd: (sel: AddSelection) => void;
}) {
  const [variant, setVariant] = useState<MenuItem>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const multiSize = product.variants.length > 1;

  function toggleMod(label: string) {
    setSelectedMods((prev) => (prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <ItemPhoto src={product.photo_url} alt={product.name} className="h-20 w-20 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-tight">{product.name}</h3>
            <div className="mt-1 text-sm font-semibold text-brand">
              {formatRs(variant.price)}
              {variant.size_label ? ` · ${variant.size_label}` : ""}
            </div>
            {product.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted">{product.description}</p>
            )}
          </div>
        </div>

        {multiSize && (
          <div className="mt-4">
            <div className="mb-1.5 text-sm font-medium">Size</div>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    v.id === variant.id
                      ? "border-brand bg-brand text-white"
                      : "border-hairline bg-surface text-ink hover:border-brand/40",
                  )}
                >
                  {v.size_label ?? "Regular"} · {formatRs(v.price)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-medium">Quantity</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-lg font-semibold hover:bg-black/10"
              aria-label="decrease"
            >
              −
            </button>
            <span className="w-6 text-center text-lg font-semibold tabular-nums">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-lg font-semibold hover:bg-black/10"
              aria-label="increase"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium">Note for kitchen (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. extra spicy, cut in 8"
            className="w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
        </div>

        {modifiers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {modifiers.map((m) => (
              <button
                key={m}
                onClick={() => toggleMod(m)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  selectedMods.includes(m)
                    ? "border-brand bg-brand-tint text-brand"
                    : "border-hairline text-muted hover:border-brand/40",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-[2]"
            onClick={() => onAdd({ variant, quantity, note: note.trim(), modifiers: selectedMods })}
          >
            Add to order · {formatRs(variant.price * quantity)}
          </Button>
        </div>
      </div>
    </div>
  );
}
