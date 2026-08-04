# Spice Pizza — Order Management & Admin

Full-stack dine-in order system for a 6-table restaurant. Replaces paper "parchi" slips
while keeping a printed-slip workflow (PDF now, thermal printer later).

- **`web/`** — Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase. Two surfaces:
  - **Counter** (`/counter`) — laptop-first: table grid → order builder → send to kitchen → bill & close.
  - **Admin** (`/admin`) — phone-first: today, reports, menu, order history, payment approvals, staff, settings.
- **`printer-bridge/`** — local Node service; v1 acknowledges print jobs (paper = PDF from the web app), v2 prints ESC/POS.

Design spec: `docs/superpowers/specs/2026-08-04-spice-pizza-design.md`.

## Setup

### 1. Database (one-time)
Run **`web/supabase/schema.sql`** once in the Supabase SQL editor
(`https://supabase.com/dashboard/project/<ref>/sql/new`). It creates all tables, indexes,
RLS (dev-permissive), and Realtime publication.

### 2. Web app
```bash
cd web
cp .env.example .env.local      # fill in Supabase URL + keys
npm install
npm run seed                    # full real menu, 6 tables, owner+counter staff, settings
npm run dev                     # http://localhost:3000  (binds 0.0.0.0 — reachable from your phone on LAN)
```

- `npm run seed -- --reset` wipes and reseeds the menu.
- Menu photos are auto-sourced external URLs (kept out of Supabase to save storage); replace per-item in Admin → Menu.

### 3. Printer bridge (optional until you buy a printer)
```bash
cd printer-bridge
npm start                       # http://localhost:4000
```
Today, "Send to Kitchen" / "Print bill" open **PDF** slips from the web app. See `printer-bridge/README.md`
for wiring a real USB/network thermal printer later.

### 4. Data retention (keeps the free tier usable)
```bash
cd web
npm run retention                # dry run — reports rollup/purge
npm run retention -- --apply     # rollup to daily_summaries, export+purge past RETENTION_DAYS, clear old screenshots
```
Schedule daily (cron). `RETENTION_DAYS` (default 30) is set in `.env.local`.

## Payments
Logging only — no gateway. Cash/card close instantly. **Online (JazzCash/EasyPaisa)** are recorded
`pending` with an optional screenshot; the owner confirms them in **Admin → Payment approvals**,
and only confirmed payments count toward revenue.

## Money
All amounts in PKR, formatted `Rs. 1,234` / `Rs. 3,12,400` (South-Asian grouping).

## Deploy
`web/` deploys to Vercel (set the same env vars). `printer-bridge/` runs on the counter PC.
