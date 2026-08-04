# Claude Code Build Prompt — Spice Pizza Order Management & Admin System

Paste everything below into Claude Code as your starting instruction.

---

## Project Summary

Build a full-stack web application for a small dine-in restaurant ("Spice Pizza") with a
6-table setup and one counter. It replaces paper order slips ("parchi") while keeping the
existing kitchen printer workflow. There are two surfaces:

1. **Counter Screen** (used on a laptop, by counter staff) — table grid, order entry, printing, billing
2. **Admin Panel** (used on both laptop and mobile by the owner) — sales dashboard, reports,
   order history, menu management, discounts

Both surfaces must be fully responsive — the Counter Screen should be designed laptop-first
(keyboard + mouse/trackpad, wide layout) but not break on a smaller window; the Admin Panel
must work equally well as a laptop dashboard and a one-handed phone view.

## Tech Stack

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Database**: Postgres via Supabase (free tier) — use Supabase for both DB and auth
- **Realtime**: Supabase Realtime (so admin dashboard and counter screen update live without refresh)
- **Hosting**: Vercel (free tier)
- **Printer bridge**: separate small Node.js service that runs locally on the counter PC,
  polls or receives a webhook/socket event when an order is sent, and prints via ESC/POS
  commands to the connected receipt printer (use the `node-thermal-printer` or `escpos` npm package)

Set up the project as a monorepo or two folders: `/web` (Next.js app) and `/printer-bridge`
(local Node service), each with its own README on how to run/deploy it.

## Roles & Auth

Two roles, enforced at the route/API level, not just hidden UI:

- **counter_staff** — table grid, order entry, printing, close & pay, view today's revenue only
- **owner** — everything counter_staff can do, plus dashboard, reports, order history, menu
  management, discount management, staff management

Use Supabase Auth (email/password is fine for a 2-person team). Seed one owner account and
one counter_staff account on first setup.

## Data Model (design tables for at least this)

- `tables` — id, number, status (free/occupied), opened_at
- `menu_categories` — id, name, sort_order
- `menu_items` — id, category_id, name, price, size_label (nullable), photo_url, is_live (bool),
  sort_order
- `menu_item_modifiers` — id, menu_item_id, label (e.g. "Extra spicy", "No onion") — quick-tag notes
- `orders` — id, table_id, opened_at, closed_at (nullable), server_name, status (open/closed/void)
- `order_rounds` — id, order_id, round_number, sent_to_kitchen_at
- `order_line_items` — id, round_id, menu_item_id, quantity, unit_price, note, is_voided (bool),
  void_reason (nullable)
- `discounts` — id, order_id, type (percent/fixed), value, applied_by, reason (optional)
- `payments` — id, order_id, method (cash/card/jazzcash/easypaisa/other), amount, paid_at

## Seed Menu Data

This is the real menu (a fast-food + pizza restaurant, not pizza-only). Use this as the
actual seed data, organized into these categories:

**Pizza** — ⚠️ source photos for this category were lost on export; seed with placeholder
items for now (e.g. Small/Medium/Large/Family sizes) and flag clearly in the UI that real
pizza items + prices need to be filled in via Menu Management once available.

**Family Deals**
| Item | Contents | Price (Rs) |
|---|---|---|
| Family Deal-01 | 2 Medium Pizza, 6 Zinger Burger, 10 Pcs Hot Wings, 3 Large Fries, 1.5 Ltr Drink, 1 Cake | 5500 |
| Family Deal-02 | 2 Small Pizza, 1 Ltr Drink | 1200 |
| Family Deal-03 | 2 Medium Pizza, 1.5 Ltr Drink | 2050 |
| Family Deal-04 | 2 Large Pizza, 1.5 Ltr Drink | 2600 |
| Family Deal-05 | 2 Family Pizza, 1.5 Ltr Drink | 2900 |
| Family Deal-06 | 2 Small Pizza, 2 Zinger Burger, 1 Ltr Drink | 1900 |
| Family Deal-07 | 1 Large Pizza, 10 Pcs Hot Wings, 1.5 Ltr Drink | 1950 |
| Family Deal-08 | 5 Tikka Pratha Roll, 1 Ltr Drink | 1400 |
| Family Deal-09 | 5 Shawarma Roll, 1 Ltr Drink | 1200 |
| Family Deal-10 | 5 Zinger Burger, 1 Family Fries, 1.5 Ltr Drink | 2100 |
| Family Deal-11 | 3 Zinger Burger, 1 Ltr Drink | 1200 |
| Family Deal-12 | Special Family Pizza, 5 Pcs Nuggets, 1.5 Ltr Drink | 2200 |
| Family Deal-13 | Family Pizza, 10 Pcs Nuggets, 1.5 Ltr Drink | 2100 |

**Regular Deals**
| Item | Contents | Price (Rs) |
|---|---|---|
| Regular Deal-01 | 1 Chicken Burger, 1 Reg Drink, 1 Reg Fries | 470 |
| Regular Deal-02 | 1 Chapli Burger, 1 Reg Drink, 1 Reg Fries | 500 |
| Regular Deal-03 | 1 Zinger Burger, 1 Reg Drink, 1 Reg Fries | 550 |
| Regular Deal-04 | 2 Zinger Burger, 2 Reg Drink, 2 Reg Fries | 1100 |
| Regular Deal-05 | 2 Tikka Pratha, 1x500ml Drink | 580 |
| Regular Deal-06 | 2 Shawarma Roll, 1x500ml Drink | 500 |
| Regular Deal-07 | 1 Cheese Stick, 1 Reg Drink | 580 |
| Regular Deal-08 | 1 Small Pizza, 1 Reg Drink | 600 |
| Regular Deal-09 | 15 Pcs Hot Shots, 1 Reg Drink | 550 |
| Regular Deal-10 | 10 Pcs Hot Wings, 1 Reg Drink | 600 |
| Regular Deal-11 | 10 Pcs BBQ Wings, 1 Reg Drink | 550 |
| Regular Deal-12 | 10 Pcs Honey Wings, 1 Reg Drink | 550 |
| Regular Deal-13 | 10 Pcs Nuggets, 1 NR Drink | 550 |
| Regular Deal-14 | 2 Zinger Burger, 5 Pcs Wings, 1 Ltr Drink | 1100 |

**Burgers**
Zinger Burger 380 · Chicken Burger 280 · Chapli Burger 300 · Sub Burger 250 · Tower Burger 600 ·
Cheezy Chicken Burger 350 · Red Burger 380 · Black Burger 380 · Filler Burger 550 ·
Cheezy Lawa Zinger 550 · Egg Burger 150 · Double Egg Burger 200 ·
Chicken Burger (Single Egg) 230 · Chicken Burger (Double Egg) 280

**Rolls**
Shawarma Roll 220 · Cheeze Shawarma Roll 280 · Zinger Shawarma Roll 280 · Zinger Pratha Roll 299 ·
Chicken Pratha Roll 260 · Kabab Pratha Roll 299 · Open Shawarma 500

**Chicken**
Hot Wings (5pcs) 270 · Hot Wings (10pcs) 550 · Nuggets (5pcs) 270 · Nuggets (10pcs) 499 ·
Hot Shot (15pcs) 500

**Fries**
Regular Fries 160 · Large Fries 230 · Family Fries 400 · Mayo Fries 450 · Loaded Fries 600

**Platters**
Turkish Platter 600 · Pizza Paratha 600

**Drinks**
NR Drink 80 · Half Ltr Drink 110 · 1 Ltr Drink 150 · 1.5 Ltr Drink 200 ·
Mineral Water 60 (small) / 120 (large)

**Spice Ice Shake** (all Rs. 450) — Pista, Kulfa, Strawberry, Vanilla, Chocolate, Mango,
Oreo, Cramel Crunch, Kit Kat

**Fresh Shake** (all Rs. 350) — Mango, Peach, Falsa, Strawberry, Mint Margarita, Strawberry Margarita

**Ice Cream** (Rs. 150 small / Rs. 200 large) — Strawberry, Kulfa, Mango, Chocolate,
Vanilla, Pista, Cramel Crunch

**Russian Salad** — Small 300 · Medium 500 · Large 750

Seed all of the above into `menu_categories` and `menu_items` on first setup — this is real
production data, not placeholder, except for the Pizza category noted above.

## Counter Screen — Required Features

1. **Table grid (home)**: 6 tables, color-coded free/occupied, shows occupied duration,
   round count, running total. "Start order" for free tables, "Add items" / "Bill & close" for occupied.
2. **Menu / order builder**: category tabs, item cards with photo, price, quick add button.
   Tapping an item opens a modal for quantity, free-text kitchen note, and quick-tag modifiers
   (Extra spicy / No onion / Extra cheese, etc. — pull these from `menu_item_modifiers`).
   Right panel shows the current round's items + running total + what's already been sent to
   kitchen in prior rounds.
3. **Send to Kitchen**: on tap, saves the round and prints two slips via the printer bridge:
   - Kitchen slip: item names, quantities, notes/modifiers only — no prices
   - Counter slip: item names, quantities, prices, and running total across all rounds so far
   If the printer bridge is unreachable, show a clear "printer offline" banner and offer
   "Retry print" — do not block saving the order in the database.
4. **Bill & close**: itemized bill across all rounds, subtotal, service charge (configurable %,
   default 5%), any discount applied, total. Buttons: "Print bill", "Apply discount" (owner PIN
   required if this action is restricted), "Close & Pay" (pick payment method, then close).
5. **Void item**: counter staff can mark a line item voided with a required reason; voided
   items are struck through in the UI and excluded from totals, but stay in the record for
   the admin's order history (never hard-delete).

## Admin Panel — Required Features

1. **Today dashboard**: today's revenue, order count + average order value, tables occupied
   now, list of live tables, recent closed bills.
2. **Reports**: weekly bar chart of revenue, weekly total vs previous week (%), orders count,
   average order value, top-selling items. Add a custom date-range picker (not just today/week)
   so the owner can pull a month or any custom range.
3. **Order history**: searchable/filterable by date and table, shows full itemized detail
   including any voided items and who voided them.
4. **Menu management**: add/edit/delete menu items (name, price, size, category, photo),
   toggle live/hidden (sold out), manage quick-tag modifiers per item.
5. **Discount management**: view discount history, set default service charge %, decide
   which roles can apply discounts.
6. **Staff**: simple list of staff accounts with role, so orders/voids can be attributed
   (matches the "Server AK" pattern already in the design).

## Non-Functional Requirements

- Fully responsive: Counter Screen is laptop-first (wide layout, mouse/trackpad + keyboard)
  but must remain usable if the window is resized smaller. Admin Panel must work equally
  well as a laptop dashboard and a one-handed phone view — this is a hard requirement, not
  a nice-to-have, since the owner checks sales from his phone.
- Use Supabase Realtime so if two devices are open at once (e.g. owner's phone + counter
  laptop), both stay in sync without manual refresh.
- All money values in PKR, formatted as "Rs. 1,234".
- Never hard-delete orders, line items, or void records within the active retention window —
  soft-delete/flag only, since this is financial data the owner will rely on for reconciliation.
- Keep the visual style close to the provided mockups: warm off-white background, red (#c0392b-ish)
  as the primary/brand color, rounded cards, clear free/occupied color coding (green/red).

## Data Lifecycle — Keeping Supabase Free Tier Usable

The free tier has row/storage caps, so raw order data should not accumulate forever. Build
an automated retention policy, not manual cleanup:

1. **Aggregate before deleting**: every night (via a Supabase scheduled Edge Function or
   pg_cron job), roll up the previous day's closed orders into a `daily_summaries` table
   (date, total revenue, order count, top items, service charge collected, discounts given).
   This is what powers historical reports — the dashboards should read from summaries for
   anything older than the retention window, not from raw orders.
2. **Retention window for raw data**: keep full itemized `orders` / `order_rounds` /
   `order_line_items` records for a rolling 30 days (configurable constant). After that,
   raw line-item detail can be purged since it's already captured in `daily_summaries`.
3. **Export before purge**: before deleting anything past the retention window, export it
   as a CSV/JSON to Supabase Storage (or trigger a download) so the owner has a permanent
   backup off-database if he ever wants old itemized detail.
4. **Void/audit records**: keep void reasons and discount records inside the same
   summary/export flow rather than deleting them separately — they matter for reconciliation.
5. Make the retention window (30 days) an environment variable, not a hardcoded number, so
   it can be shortened if the free tier gets tight, or lengthened once/if upgraded to a paid plan.

## Build Order (tell Claude Code to do this incrementally, not all at once)

1. Scaffold Next.js + Tailwind + Supabase client, set up the DB schema and seed data
   (6 tables, a handful of menu items across categories, one owner + one counter_staff user)
2. Build the Counter Screen: table grid → order builder → send to kitchen (stub printing
   for now) → bill & close
3. Build the Admin Panel: today dashboard → reports → order history → menu management → discounts
4. Build the printer-bridge service as a separate small Node app with clear setup instructions
   (how to point it at the counter PC's printer, how the web app calls it)
5. Wire up auth/roles and route protection last, once the core flows work

## Ask Me First

Before writing code, ask me:
- The exact printer model/connection type (USB, network/IP, or Bluetooth) so the printer
  bridge uses the right library
- Whether I want real payment processing or just payment-method logging (for reconciliation only)
- The starting menu list and categories (or whether to use placeholder data for now)
