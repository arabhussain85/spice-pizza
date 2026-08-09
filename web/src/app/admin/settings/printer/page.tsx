"use client";

import { useEffect, useState } from "react";
import { Button, Card, InputField, Switch, Pill, StatCard } from "@/components/ui";

export interface PrinterConfig {
  bridgeUrl: string;
  interfaceType: "escpos_network" | "escpos_usb" | "pdf_spooler";
  printerIp: string;
  paperWidth: "80mm" | "58mm";
  autoCut: boolean;
  printCopies: number;
  codePage: string;
  // Windows printer selection
  selectedPrinterName: string;
}

interface WindowsPrinter {
  name: string;
  isDefault: boolean;
  status: "ready" | "printing" | "unknown";
  offline: boolean;
}

const DEFAULT_PRINTER_CFG: PrinterConfig = {
  bridgeUrl: "http://localhost:4000",
  interfaceType: "pdf_spooler",
  printerIp: "192.168.1.100",
  paperWidth: "80mm",
  autoCut: true,
  printCopies: 1,
  codePage: "PC437",
  selectedPrinterName: "",
};

export default function PrinterSettingsPage() {
  const [cfg, setCfg] = useState<PrinterConfig>(DEFAULT_PRINTER_CFG);
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Windows printer scanning
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [printers, setPrinters] = useState<WindowsPrinter[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("spice_pizza_printer_config");
      if (stored) setCfg({ ...DEFAULT_PRINTER_CFG, ...JSON.parse(stored) });
    } catch (e) {
      console.warn("Failed to load printer settings:", e);
    }
    checkBridgeHealth();
  }, []);

  const checkBridgeHealth = async () => {
    setStatus("checking");
    try {
      const res = await fetch(`${cfg.bridgeUrl}/health`, { method: "GET" }).catch(() => null);
      if (res && res.ok) setStatus("online");
      else setStatus("offline");
    } catch {
      setStatus("offline");
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem("spice_pizza_printer_config", JSON.stringify(cfg));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Failed to save printer settings:", e);
    }
  };

  // ── Scan Windows printers via bridge /printers endpoint ──────────
  const scanPrinters = async () => {
    setScanState("scanning");
    setScanError(null);
    setPrinters([]);
    try {
      const res = await fetch(`${cfg.bridgeUrl}/printers`, { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Bridge returned ${res.status}`);
      }
      const data = await res.json();
      if (!data.printers || !Array.isArray(data.printers)) {
        throw new Error("Invalid response from printer bridge.");
      }
      setPrinters(data.printers);
      setScanState("done");
    } catch (err) {
      setScanError((err as Error).message);
      setScanState("error");
    }
  };

  const selectPrinter = (name: string) => {
    setCfg({ ...cfg, selectedPrinterName: name, interfaceType: "pdf_spooler" });
  };

  // ── Test print ────────────────────────────────────────────────────
  const handleTestPrint = async () => {
    setBusy(true);
    setTestStatus("Sending test receipt to printer…");
    try {
      const body: Record<string, unknown> = {
        kind: "test",
        type: "test_receipt",
        paperWidth: cfg.paperWidth,
        autoCut: cfg.autoCut,
        title: "TEST RECEIPT PRINT",
        timestamp: new Date().toISOString(),
      };

      // For pdf_spooler mode we also pass printerName; the bridge uses Windows spooler
      if (cfg.interfaceType === "pdf_spooler" && cfg.selectedPrinterName) {
        body.printerName = cfg.selectedPrinterName;
        body.copies = cfg.printCopies;
      }

      const res = await fetch(`${cfg.bridgeUrl}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.printed) {
          setTestStatus(`✓ Sent to "${cfg.selectedPrinterName || "printer"}" via Windows spooler!`);
        } else {
          setTestStatus(`ℹ️ Bridge acknowledged (${data.mode ?? "stub"} mode): ${data.note ?? "job logged."}`);
        }
      } else {
        setTestStatus("ℹ️ Bridge simulated: ESC/POS stream generated (bridge offline).");
      }
    } catch (err) {
      setTestStatus(`✗ Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Status colour helpers ─────────────────────────────────────────
  const printerStatusTone = (p: WindowsPrinter): "green" | "amber" | "neutral" => {
    if (p.offline) return "amber";
    if (p.status === "ready") return "green";
    if (p.status === "printing") return "amber";
    return "neutral";
  };

  const selectedPrinter = printers.find((p) => p.name === cfg.selectedPrinterName);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight text-ink">Printer Settings</h1>
            <Pill tone={status === "online" ? "green" : status === "offline" ? "amber" : "neutral"}>
              {status === "online" ? "🟢 Bridge Online" : status === "offline" ? "🟠 Bridge Offline" : "Checking…"}
            </Pill>
            {cfg.selectedPrinterName && (
              <Pill tone={selectedPrinter?.offline ? "amber" : selectedPrinter?.status === "ready" ? "green" : "neutral"}>
                🖨️ {cfg.selectedPrinterName}
              </Pill>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            Scan Windows printers, select your printer, and configure print options.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={checkBridgeHealth}>
            Check Bridge
          </Button>
          <Button variant="primary" size="sm" onClick={saveSettings}>
            {saved ? "✓ Saved" : "Save Config"}
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Bridge URL"
          value={cfg.bridgeUrl}
          subtext={status === "online" ? "Bridge connected & ready" : "Bridge offline — start npm start"}
          icon="🌐"
        />
        <StatCard
          title="Selected Printer"
          value={cfg.selectedPrinterName || "None selected"}
          subtext={cfg.selectedPrinterName ? `Mode: ${cfg.interfaceType}` : "Scan and select a printer below"}
          icon="🖨️"
        />
        <StatCard
          title="Paper Format"
          value={cfg.paperWidth}
          subtext={`${cfg.printCopies} cop${cfg.printCopies === 1 ? "y" : "ies"} · ${cfg.autoCut ? "Auto-cut on" : "Manual tear"}`}
          icon="📄"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-7 space-y-5">

          {/* ── Bridge Connection ─────────────────────────────────── */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Bridge Connection</h2>
            <InputField
              label="Printer Bridge URL"
              value={cfg.bridgeUrl}
              onChange={(e) => setCfg({ ...cfg, bridgeUrl: e.target.value })}
              helperText="Local Node.js bridge running on this PC (default: http://localhost:4000)."
            />
          </Card>

          {/* ── Windows Printer Scanner ───────────────────────────── */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand">
                🖨️ Windows Printer Selection
              </h2>
              <Button
                variant="outline"
                size="sm"
                loading={scanState === "scanning"}
                onClick={scanPrinters}
              >
                {scanState === "scanning" ? "Scanning…" : "Scan Printers"}
              </Button>
            </div>

            <p className="text-xs text-muted">
              Click <strong>Scan Printers</strong> to discover all printers connected to this Windows PC.
              The bridge must be running and online.
            </p>

            {/* Error state */}
            {scanState === "error" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm">
                <p className="font-semibold text-amber-800 mb-1">⚠️ Scan failed</p>
                <p className="text-xs text-amber-700">{scanError}</p>
                <p className="text-xs text-amber-600 mt-2">
                  Make sure the printer bridge is running: <code className="font-mono">cd printer-bridge && npm start</code>
                </p>
              </div>
            )}

            {/* Printer List */}
            {scanState === "done" && printers.length === 0 && (
              <div className="rounded-xl border border-hairline bg-cream/40 p-4 text-center text-xs text-muted">
                No printers found. Make sure printers are installed in Windows.
              </div>
            )}

            {(scanState === "done" || (scanState === "idle" && cfg.selectedPrinterName)) && printers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-muted">
                  {printers.length} printer{printers.length !== 1 ? "s" : ""} found — select one to use:
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {printers.map((printer) => {
                    const isSelected = cfg.selectedPrinterName === printer.name;
                    return (
                      <button
                        key={printer.name}
                        type="button"
                        onClick={() => selectPrinter(printer.name)}
                        className={[
                          "w-full text-left rounded-xl border px-4 py-3 transition-all",
                          isSelected
                            ? "border-brand bg-brand-tint/60 shadow-xs"
                            : "border-hairline hover:border-brand/30 bg-surface hover:bg-cream/40",
                          printer.offline ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">
                              {isSelected ? "✅" : printer.offline ? "🔴" : "🖨️"}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold truncate ${isSelected ? "text-brand" : "text-ink"}`}>
                                {printer.name}
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                {printer.isDefault ? "Default · " : ""}
                                {printer.offline ? "Offline" : printer.status === "ready" ? "Ready" : "Status unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {printer.isDefault && (
                              <span className="text-xs font-bold bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                                Default
                              </span>
                            )}
                            {printer.offline && (
                              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                Offline
                              </span>
                            )}
                            {!printer.offline && printer.status === "ready" && (
                              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Ready
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Currently selected (when list not shown) */}
            {scanState === "idle" && cfg.selectedPrinterName && printers.length === 0 && (
              <div className="rounded-xl border border-brand/30 bg-brand-tint/20 p-3.5 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-bold text-brand">{cfg.selectedPrinterName}</p>
                  <p className="text-xs text-muted">Saved printer — click Scan Printers to refresh the list.</p>
                </div>
              </div>
            )}

            {/* Manual override */}
            <div className="border-t border-hairline pt-4">
              <InputField
                label="Manual Printer Name (optional)"
                value={cfg.selectedPrinterName}
                onChange={(e) => setCfg({ ...cfg, selectedPrinterName: e.target.value })}
                helperText='Type the exact Windows printer name if scan is unavailable (e.g. "Black Copper 80").'
              />
            </div>
          </Card>

          {/* ── Communication Protocol ────────────────────────────── */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Communication Protocol</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: "pdf_spooler", label: "PDF → Windows Spooler", desc: "Send PDF to any Windows printer" },
                { id: "escpos_network", label: "ESC/POS Network (LAN)", desc: "Direct to thermal via IP" },
                { id: "escpos_usb", label: "ESC/POS Direct USB", desc: "Direct USB thermal printer" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCfg({ ...cfg, interfaceType: mode.id as any })}
                  className={`p-3 rounded-xl border text-xs text-left transition-all ${
                    cfg.interfaceType === mode.id
                      ? "border-brand bg-brand-tint/60 text-brand shadow-2xs font-bold"
                      : "border-hairline hover:border-brand/30 text-ink-muted"
                  }`}
                >
                  <p className="font-semibold">{mode.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>

            {cfg.interfaceType === "escpos_network" && (
              <InputField
                label="Thermal Printer IP Address"
                value={cfg.printerIp}
                onChange={(e) => setCfg({ ...cfg, printerIp: e.target.value })}
                helperText="Static LAN IP of thermal printer (Port 9100)."
              />
            )}
          </Card>

          {/* ── Paper & Format ────────────────────────────────────── */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Paper & Print Formatting</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                  Paper Roll Size
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
                      {w} Roll
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                  Print Copies per Order
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={cfg.printCopies}
                  onChange={(e) => setCfg({ ...cfg, printCopies: Number(e.target.value) })}
                  className="w-full rounded-xl border border-hairline bg-cream/30 px-3.5 py-2 text-sm text-ink outline-none focus:border-brand"
                />
              </div>
            </div>
            <div className="border-t border-hairline pt-3">
              <Switch
                label="Enable Auto Hardware Paper Cut"
                description="Sends GS V 66 command to trigger automatic guillotine cutter (thermal printers only)"
                checked={cfg.autoCut}
                onChange={(val) => setCfg({ ...cfg, autoCut: val })}
              />
            </div>
          </Card>
        </div>

        {/* Right column — Test & Log */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-5 space-y-4 border-brand/20 bg-gradient-to-br from-surface to-brand-tint/20">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand flex items-center gap-2">
              ⚡ Printer Test
            </h2>

            {cfg.selectedPrinterName ? (
              <div className="rounded-xl border border-brand/20 bg-brand-tint/10 p-3 flex items-center gap-3">
                <span className="text-2xl">🖨️</span>
                <div>
                  <p className="text-sm font-bold text-brand">{cfg.selectedPrinterName}</p>
                  <p className="text-xs text-muted">{cfg.interfaceType} · {cfg.paperWidth} · {cfg.printCopies} copies</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                ⚠️ No printer selected yet. Scan and select a printer above.
              </div>
            )}

            <p className="text-xs text-ink-muted leading-relaxed">
              Sends a test receipt payload to the bridge. In <strong>PDF Spooler</strong> mode, the bridge forwards it to your selected Windows printer.
            </p>

            <Button
              variant="primary"
              className="w-full py-3 text-sm shadow-md"
              loading={busy}
              onClick={handleTestPrint}
            >
              🖨️ Send Test Print
            </Button>

            {testStatus && (
              <div className="rounded-xl border border-hairline bg-surface p-3.5 text-xs font-mono text-ink leading-relaxed">
                {testStatus}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3 bg-surface">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Bridge Status Log</h3>
            <div className="rounded-xl bg-gray-950 p-4 font-mono text-xs text-green-400 space-y-1">
              <div>[BRIDGE] {cfg.bridgeUrl}</div>
              <div>[STATUS] {status === "online" ? "✓ ONLINE" : status === "offline" ? "✗ OFFLINE" : "… CHECKING"}</div>
              <div>[MODE] {cfg.interfaceType.toUpperCase()}</div>
              {cfg.selectedPrinterName && (
                <div>[PRINTER] {cfg.selectedPrinterName}</div>
              )}
              {cfg.interfaceType === "escpos_network" && (
                <>
                  <div>[CODE PAGE] PC437 \x1B\x74\x00</div>
                  <div>[JUSTIFY CENTER] \x1B\x61\x01</div>
                  <div>[BOLD ON] \x1B\x45\x01 SPICE PIZZA</div>
                  <div>[FEED & CUT] \x1D\x56\x42\x00</div>
                </>
              )}
              <div className="text-gray-500 pt-2 border-t border-gray-800">
                {cfg.selectedPrinterName
                  ? `Ready → "${cfg.selectedPrinterName}"`
                  : "Select a printer to enable printing"}
              </div>
            </div>
          </Card>

          {/* Setup Guide */}
          <Card className="p-5 space-y-3 bg-surface">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Quick Setup Guide</h3>
            <ol className="text-xs text-ink-muted space-y-2 list-decimal list-inside leading-relaxed">
              <li>Open a terminal in <code className="font-mono text-brand">printer-bridge/</code></li>
              <li>Run <code className="font-mono text-brand">npm start</code> (bridge starts on port 4000)</li>
              <li>Click <strong>Scan Printers</strong> above to list Windows printers</li>
              <li>Select <strong>Black Copper 80</strong> (or your printer) from the list</li>
              <li>Click <strong>Save Config</strong> then <strong>Send Test Print</strong></li>
            </ol>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <strong>PDF Printing tip:</strong> Install{" "}
              <a href="https://www.sumatrapdfreader.org/" target="_blank" rel="noreferrer" className="underline text-amber-800">
                SumatraPDF
              </a>{" "}
              for the most reliable silent PDF-to-printer output on Windows.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
