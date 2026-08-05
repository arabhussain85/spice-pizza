"use client";

import { useEffect, useState } from "react";
import { Button, Card, InputField, Switch, Pill } from "@/components/ui";

export interface ReceiptCustomConfig {
  restaurantName: string;
  tagline: string;
  address: string;
  phone: string;
  ntnNumber: string;
  footerNote: string;
  showTaxBreakdown: boolean;
  showWifiInfo: boolean;
  showItemNotes: boolean;
  paperWidth: "80mm" | "58mm";
  fontSize: "normal" | "compact" | "large";
}

const DEFAULT_CONFIG: ReceiptCustomConfig = {
  restaurantName: "SPICE PIZZA",
  tagline: "Authentic Wood-Fired & Special Pizzas",
  address: "Shop #4, Food Street, Main Boulevard, Lahore",
  phone: "+92 300 1234567",
  ntnNumber: "NTN: 7654321-9",
  footerNote: "Thank you for dining with us! Please visit again.",
  showTaxBreakdown: true,
  showWifiInfo: true,
  showItemNotes: true,
  paperWidth: "80mm",
  fontSize: "normal",
};

export default function ReceiptCustomizerPage() {
  const [cfg, setCfg] = useState<ReceiptCustomConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("spice_pizza_receipt_config");
      if (stored) {
        setCfg({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.warn("Failed to load receipt config:", e);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem("spice_pizza_receipt_config", JSON.stringify(cfg));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Failed to save receipt config:", e);
    }
  };

  const resetDefaults = () => {
    setCfg(DEFAULT_CONFIG);
    localStorage.removeItem("spice_pizza_receipt_config");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-ink">Receipt Customizer</h1>
            <Pill tone="blue">Template Editor</Pill>
          </div>
          <p className="mt-1 text-xs text-muted">
            Design and format thermal printed receipts. Changes update in real-time below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetDefaults}>
            Reset Defaults
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            {saved ? "✓ Saved" : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Form Controls (Left) & Live Thermal Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Section */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Header & Business Info</h2>
            <InputField
              label="Restaurant Name"
              value={cfg.restaurantName}
              onChange={(e) => setCfg({ ...cfg, restaurantName: e.target.value })}
            />
            <InputField
              label="Tagline / Subtitle"
              value={cfg.tagline}
              onChange={(e) => setCfg({ ...cfg, tagline: e.target.value })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Address"
                value={cfg.address}
                onChange={(e) => setCfg({ ...cfg, address: e.target.value })}
              />
              <InputField
                label="Phone Number"
                value={cfg.phone}
                onChange={(e) => setCfg({ ...cfg, phone: e.target.value })}
              />
            </div>
            <InputField
              label="NTN / STRN Registration Number"
              value={cfg.ntnNumber}
              onChange={(e) => setCfg({ ...cfg, ntnNumber: e.target.value })}
            />
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Layout & Thermal Settings</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                  Paper Width
                </label>
                <div className="flex rounded-xl border border-hairline p-1 bg-cream/40">
                  {(["80mm", "58mm"] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setCfg({ ...cfg, paperWidth: w })}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        cfg.paperWidth === w ? "bg-brand text-white shadow-xs" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {w === "80mm" ? "80mm (Standard)" : "58mm (Compact)"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                  Font Scale
                </label>
                <div className="flex rounded-xl border border-hairline p-1 bg-cream/40">
                  {(["compact", "normal", "large"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCfg({ ...cfg, fontSize: s })}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                        cfg.fontSize === s ? "bg-brand text-white shadow-xs" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-hairline pt-3 space-y-3">
              <Switch
                label="Show Tax & Service Charge Breakdown"
                description="Include 5% service charge line items on receipt"
                checked={cfg.showTaxBreakdown}
                onChange={(val) => setCfg({ ...cfg, showTaxBreakdown: val })}
              />
              <Switch
                label="Show Custom Item Modifiers/Notes"
                description="Print customer specific item preparation instructions"
                checked={cfg.showItemNotes}
                onChange={(val) => setCfg({ ...cfg, showItemNotes: val })}
              />
              <Switch
                label="Include Customer Wi-Fi Info"
                description="Prints guest Wi-Fi details at the bottom of the slip"
                checked={cfg.showWifiInfo}
                onChange={(val) => setCfg({ ...cfg, showWifiInfo: val })}
              />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Footer Message</h2>
            <InputField
              label="Thank You Note"
              value={cfg.footerNote}
              onChange={(e) => setCfg({ ...cfg, footerNote: e.target.value })}
              helperText="Printed at the very bottom of every bill."
            />
          </Card>
        </div>

        {/* Thermal Receipt Live Preview */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Live Receipt Preview</span>
            <Pill tone="amber">{cfg.paperWidth} Thermal Slip</Pill>
          </div>

          <div
            className={`receipt-paper mx-auto p-5 rounded-lg border border-gray-300 text-gray-900 transition-all ${
              cfg.paperWidth === "58mm" ? "max-w-[280px]" : "max-w-[360px]"
            } ${
              cfg.fontSize === "compact" ? "text-xs" : cfg.fontSize === "large" ? "text-base" : "text-sm"
            }`}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400 space-y-1">
              <h3 className="font-extrabold text-lg uppercase tracking-tight text-black">{cfg.restaurantName || "SPICE PIZZA"}</h3>
              {cfg.tagline && <p className="text-xs text-gray-600 italic">{cfg.tagline}</p>}
              <p className="text-xs text-gray-700 leading-tight">{cfg.address}</p>
              <p className="text-xs font-semibold text-gray-800">Tel: {cfg.phone}</p>
              {cfg.ntnNumber && <p className="text-[11px] text-gray-500">{cfg.ntnNumber}</p>}
            </div>

            {/* Meta */}
            <div className="py-2.5 border-b border-dashed border-gray-400 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold">ORDER #SP-104</span>
                <span>TABLE #3</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Date: {new Date().toLocaleDateString("en-PK")}</span>
                <span>Time: 08:45 PM</span>
              </div>
              <div className="text-gray-600">Staff: AK (Counter)</div>
            </div>

            {/* Line Items Table */}
            <div className="py-3 border-b border-dashed border-gray-400">
              <div className="flex justify-between font-bold text-xs border-b border-gray-300 pb-1 mb-2">
                <span>ITEM</span>
                <span>AMOUNT</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between font-medium">
                    <span>2x Chicken Tikka Pizza (Large)</span>
                    <span>Rs. 3,600</span>
                  </div>
                  {cfg.showItemNotes && (
                    <div className="text-[11px] text-gray-500 pl-3">↳ Extra Cheese, Crispy Crust</div>
                  )}
                </div>
                <div>
                  <div className="flex justify-between font-medium">
                    <span>1x Garlic Bread Stuffed</span>
                    <span>Rs. 650</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-medium">
                    <span>3x Mint Margarita</span>
                    <span>Rs. 1,050</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-xs">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span>Rs. 5,300</span>
              </div>
              {cfg.showTaxBreakdown && (
                <div className="flex justify-between text-gray-700">
                  <span>Service Charge (5%)</span>
                  <span>Rs. 265</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1.5 text-black border-t border-gray-300">
                <span>NET TOTAL</span>
                <span>Rs. {cfg.showTaxBreakdown ? "5,565" : "5,300"}</span>
              </div>
            </div>

            {/* Wi-Fi Info */}
            {cfg.showWifiInfo && (
              <div className="py-2 text-center border-b border-dashed border-gray-400 text-[11px]">
                <span className="font-semibold">📶 Customer Wi-Fi:</span> SpicePizza_Guest / Pass: <span className="font-mono font-bold">pizza123</span>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 text-center text-xs text-gray-600 leading-tight space-y-1">
              <p className="font-medium italic">{cfg.footerNote}</p>
              <div className="pt-1 text-[10px] text-gray-400 uppercase tracking-widest font-mono">
                *** POWERED BY SPICE PIZZA ***
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
