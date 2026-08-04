# Spice Pizza — Printer Bridge

A small local service that runs on the **counter PC** and turns order events into printed
receipt slips. It is intentionally separate from the web app so it can talk to a physically
connected thermal printer that a cloud-hosted (Vercel) app cannot reach.

## Status

- **v1 (current):** zero-dependency HTTP service that **acknowledges** print jobs. Paper output
  right now is a **PDF produced by the web app** (open/print from the browser). This lets us build
  and test the whole "send to kitchen / print bill / printer offline / retry" flow with no hardware.
- **v2 (when a printer is bought):** implement `escpos()` in `src/index.js` to print ESC/POS slips.

## Run

```bash
cd printer-bridge
npm start          # listens on http://localhost:4000
# PORT=4000 PRINTER_MODE=stub  (defaults)
```

The web app calls it via `PRINTER_BRIDGE_URL` (default `http://localhost:4000`).

## Endpoints

- `GET /health` → `{ ok, mode }`
- `POST /print` with a job body:
  ```json
  { "kind": "kitchen | counter | bill", "orderId": "…", "roundId": "…",
    "lines": [{ "qty": 1, "name": "Chicken Tikka (L)", "note": "extra spicy", "price": 1350 }],
    "meta": { "table": 3, "server": "AK", "total": 3749 } }
  ```
  `kind=kitchen` omits prices; `counter` and `bill` include prices/totals.

## Connecting a real printer (v2)

1. `npm i node-thermal-printer`
2. Set the connection via env:
   - **USB:** `PRINTER_MODE=usb PRINTER_INTERFACE=printer:auto` (or the OS device path)
   - **Network/IP:** `PRINTER_MODE=network PRINTER_INTERFACE=tcp://192.168.1.50:9100`
3. Implement `escpos(job)` in `src/index.js` (an EPSON example is stubbed in comments).
4. Restart the bridge. The web app needs no change — it already POSTs jobs here.
