# Spice Pizza — Order Management & Admin System — Design Spec

**Date:** 2026-08-04
**Source prompt:** `spicy-pizza-claude-code-prompt(1).md`
**Design reference:** `spice-docs/Spicy Pizza — screen mockups.pdf` (6 screens), `Spicy Pizza(1).html` (standalone), real menu photos in `menu-images/`.

## 1. Summary

Full-stack web app for a 6-table + 1-counter dine-in restaurant ("Spice Pizza"). Replaces
paper "parchi" slips while keeping a printed-slip workflow (PDF now, thermal printer later).
Two surfaces:

1. **Counter Screen** — laptop-first (1280-wide). Table grid → order builder → send to kitchen → bill & close.
2. **Admin Panel** — phone-first (390-wide), also works on laptop. Today dashboard, reports, order history, menu management, discounts, payment approvals, staff.

## 2. Locked decisions

- **Payments = logging only** (no gateway). Cash/card close instantly. **Online payments
  (JazzCash/EasyPaisa) use an admin-approval flow:** counter records method = online → status
  `pending`, may attach a **payment screenshot**; the **owner confirms** in the Admin Panel →
  status `confirmed` and the bill is settled. Screenshots are deleted after confirmation + grace window (storage hygiene).
- **Printing = PDF for now.** Send to Kitchen and Print Bill generate PDFs. `printer-bridge`
  service is scaffolded so real ESC/POS printing is a later drop-in (no hardware yet).
- **Menu images = external URLs** (not uploaded to Supabase, to keep storage free). Each item
  is seeded with a category-relevant food image URL, flagged auto-sourced, replaceable in Menu Management.
- **Menu seed = full real menu** (Appendix A), including the real Pizza lines recovered from the photos.
- **Design:** clean Tailwind matching the PDF mockups; structured so a later Stitch design can be layered in.

## 3. Architecture

Monorepo with two folders, each with its own README:

- **`/web`** — Next.js (App Router) + TypeScript + Tailwind + Supabase JS. Server components /
  route handlers use the **service role** key server-side only; browser uses the **anon** key.
  Realtime via `supabase-js` channels so counter + owner's phone stay in sync.
- **`/printer-bridge`** — small Node service. v1: accepts a print job (order/round/bill),
  renders a **PDF** (kitchen slip = no prices; counter slip = prices + running total; bill).
  v2 (later): same interface, outputs ESC/POS to a USB/network printer via `node-thermal-printer`.
- **DB** — the user's real Supabase project (`lzoqyoasljfvyiqcjkgc`). Schema + seed via SQL migrations.

### Print flow (v1, PDF)
Web app POSTs a print job to the bridge (or, if bridge offline, the web app itself renders the
PDF as a fallback download). Kitchen + counter slips generated on Send to Kitchen; bill on Print Bill.
If the bridge is unreachable, show a **"printer offline"** banner + **Retry**, but **never block the DB save**.

### Secrets
`.env.local` (gitignored) holds Supabase URL, anon key, service role key, DB connection string.
Keys are never committed. `printer-bridge` gets its own `.env`.

### DB application strategy (network note)
Direct Postgres `:5432` is IPv6-only and unreachable from the build sandbox; HTTPS/443 works.
Migration application order of preference:
1. `pg`/`postgres.js` over the **Supavisor pooler** (IPv4) if reachable.
2. Otherwise emit the combined SQL and apply via the **Supabase dashboard SQL editor** (one paste) or `psql` from the user's own shell (`! psql "<conn>" -f ...`).
Seed *data* (not DDL) can also go through the service-role PostgREST client over HTTPS as a fallback.

## 4. Data model

Prompt tables (`tables`, `menu_categories`, `menu_items`, `menu_item_modifiers`, `orders`,
`order_rounds`, `order_line_items`, `discounts`, `payments`) plus:

- **`menu_items`**: `size_label` (nullable) + `price` per size → one row per size variant; a
  nullable `group_key` links sizes of the same product so the order builder can offer a size
  picker. `photo_url` = external image URL. `is_live` toggles counter visibility.
- **`payments`**: add `status` (`pending`|`confirmed`), `confirmed_by`, `confirmed_at`,
  `screenshot_url` (nullable). Online method → `pending` until owner confirms.
- **`settings`** (singleton): `service_charge_pct` (default 5), `discounts_role` (who may apply
  discounts), `retention_days` (mirror of env default 30).
- **`daily_summaries`**: `date`, `revenue`, `order_count`, `avg_order`, `service_charge_total`,
  `discount_total`, `top_items` (jsonb). Powers reports older than the retention window.
- **`staff`/profiles**: id, name, role (`owner`|`counter_staff`) — attribution for orders/voids/confirmations.

Soft-delete/flag only for orders, line items, voids, discounts, payments within retention. Never hard-delete live financial data.

## 5. Data lifecycle (keep free tier usable)

Nightly job (pg_cron or Supabase scheduled Edge Function):
1. Roll up previous day's **closed** orders into `daily_summaries`.
2. Keep raw `orders`/`order_rounds`/`order_line_items` for `RETENTION_DAYS` (env, default 30).
3. **Before purge, export** the aging window to CSV/JSON (Supabase Storage or download).
4. Purge raw detail past the window (summaries retain the aggregates; voids/discounts captured in the export).
5. Delete confirmed **payment screenshots** after a short grace window.
`RETENTION_DAYS` is an env var, not hardcoded.

## 6. Roles & auth (built last, per prompt)

Supabase Auth (email/password). Two roles enforced at route + API level (not just hidden UI):
- **counter_staff** — table grid, order entry, PDF slips, close & pay, today's revenue only.
- **owner** — everything + dashboard, reports, history, menu mgmt, discounts, payment approvals, staff.
Seed one owner + one counter_staff on first setup. Route protection via middleware + server-side role checks.

## 7. Visual design (from mockups)

- Primary red `#c0392b`; warm off-white background; green = free / red = occupied; rounded cards; soft shadows.
- Money formatted `Rs. 1,234` (PKR, thousands separators, no decimals).
- **Counter** (laptop-first, wide) but resizes down without breaking:
  - *Table grid:* header (logo, "N tables free" pill, time, staff avatar); 3×2 table cards with
    state color, occupied duration, round count, running total, contextual button (Start order / Add items / Bill & close).
  - *Order builder:* back link, table + round + timer, search, View bill; scrollable category
    tabs; item cards (photo, name, price, +); item modal (qty stepper, kitchen note, quick-tag
    modifiers, Add to order); right "This round" panel with items, already-sent total, round subtotal, Send to Kitchen.
  - *Bill/close:* itemized bill grouped by round, subtotal, service charge %, discount, total; Print bill + Close & Pay (payment method picker, online-approval path).
- **Admin** (phone-first) with bottom tab bar (Today / Reports / Menu):
  - *Today:* greeting, big revenue card (+% vs yesterday), orders + avg cards, tables-occupied,
    live-tables chips, recent closed bills.
  - *Reports:* weekly revenue + %, 7-bar chart, orders + avg order, top sellers, custom date-range picker.
  - *Menu:* count, search, filter chips, item rows (photo, name, category·size, price, Live/Hidden), Add/Edit item sheet (photo, name, price, category, show-on-counter toggle).

## 8. Build order (incremental; verify each milestone)

1. Scaffold `/web` + `/printer-bridge`, Supabase clients, env, `.gitignore`, git init.
2. DB schema + seed (Appendix A menu, 6 tables, 1 owner + 1 counter_staff, settings, modifiers).
3. Counter: table grid → order builder → send to kitchen (PDF) → bill & close (incl. online-approval).
4. Admin: today → reports → order history → menu management → discounts/settings → payment approvals → staff.
5. Realtime wiring → auth + role route protection → retention jobs.

## 9. Out of scope (YAGNI)

No real payment gateway, no delivery/online ordering, no inventory, no loyalty, no multi-branch.

---

## Appendix A — Full menu seed

Money in PKR. Multi-size products = one `menu_item` row per size sharing a `group_key`.

### Pizzas — Classic (Small 550 / Medium 1050 / Large 1350 / Family 1550; extra topping 99/149/199/249)
Chicken Tikka · Chicken Fajita · Tandoori · Hot-N-Spicy · Chicken Achari · Vege Lover · Chicken Supreme · Cheesy Gold

### Spice Special Pizzas (Medium 1350 / Large 1550 / Family 1850)
Spice Special · Behari Kabab · Stuffed Crust · Crown Crust · Fajita Sicilian · Kababish · Legend Malai · Super Supreme · Cheese Stuffed · Cheeze Creamy · Chapli Kabab · Round Kabab · Zinger Fried · Pasta Pizza

### Square Pizza (Small 900 / Medium 1500 / Large 2000 / Family 2300)

### Double / Four Flavour Pizza (Medium 1350 / Large 1550 / Family 1850)
Double Flavour · Four Flavour

### Family Deals (Rs)
01 5500 · 02 1200 · 03 2050 · 04 2600 · 05 2900 · 06 1900 · 07 1950 · 08 1400 · 09 1200 · 10 2100 · 11 1200 · 12 2200 · 13 2100
(contents per prompt table)

### Regular Deals (Rs)
01 470 · 02 500 · 03 550 · 04 1100 · 05 580 · 06 500 · 07 580 · 08 600 · 09 550 · 10 600 · 11 550 · 12 550 · 13 550 · 14 1100
(contents per prompt table)

### Burgers
Zinger 380 · Chicken 280 · Chapli 300 · Sub 250 · Tower 600 · Cheezy Chicken 350 · Red 380 · Black 380 · Filler 550 · Cheezy Lawa Zinger 550 · Egg 150 · Double Egg 200 · Chicken (Single Egg) 230 · Chicken (Double Egg) 280

### Rolls
Shawarma 220 · Cheeze Shawarma 280 · Zinger Shawarma 280 · Zinger Pratha 299 · Chicken Pratha 260 · Kabab Pratha 299 · Open Shawarma 500

### Chicken
Hot Wings 5pcs 270 · Hot Wings 10pcs 550 · Nuggets 5pcs 270 · Nuggets 10pcs 499 · Hot Shot 15pcs 500

### Fries
Regular 160 · Large 230 · Family 400 · Mayo 450 · Loaded 600

### Cheese Sticks
Special 650 · Cheese 550 · Garlic 600 · Kababish 650 · BBQ 600 · Crunchy 650 · Crown 1100 · Chicken Cheese Boll (5pcs) 400

### Special Pasta
Flaming 650 · Creamy 650 · Crunchy 699 · Kababish 699 · Matka Fries 699 · Matka Pasta 699

### Platters
Turkish Platter 600 · Pizza Paratha 600

### Drinks
NR 80 · Half Ltr 110 · 1 Ltr 150 · 1.5 Ltr 200 · Mineral Water (Small 60 / Large 120)

### Spice Ice Shake (all 450)
Pista · Kulfa · Strawberry · Vanilla · Chocolate · Mango · Oreo · Cramel Crunch · Kit Kat

### Fresh Shake (all 350)
Mango · Peach · Falsa · Strawberry · Mint Margarita · Strawberry Margarita

### Ice Cream (Small 150 / Large 200)
Strawberry · Kulfa · Mango · Chocolate · Vanilla · Pista · Cramel Crunch

### Russian Salad (Small 300 / Medium 500 / Large 750)

### Quick-tag modifiers (menu_item_modifiers, seeded on relevant items)
Extra spicy · No onion · Extra cheese · Less spicy · Extra topping · Well done
