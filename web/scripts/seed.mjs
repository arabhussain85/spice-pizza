// Seed Spice Pizza reference data over HTTPS (service role — bypasses RLS).
// Usage:  node scripts/seed.mjs            (seed only if empty)
//         node scripts/seed.mjs --reset    (wipe menu + reseed)
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const RESET = process.argv.includes("--reset");

// --- relevant auto-sourced image per keyword (external URL; keeps Supabase storage free) ---
const img = (keywords, lock) =>
  `https://loremflickr.com/400/300/${encodeURIComponent(keywords)}?lock=${lock}`;

let LOCK = 1;
const photo = (kw) => img(kw, LOCK++);

// size price lists
const CLASSIC = [["Small", 550], ["Medium", 1050], ["Large", 1350], ["Family", 1550]];
const SPECIAL = [["Medium", 1350], ["Large", 1550], ["Family", 1850]];
const SQUARE = [["Small", 900], ["Medium", 1500], ["Large", 2000], ["Family", 2300]];
const FLAVOUR = [["Medium", 1350], ["Large", 1550], ["Family", 1850]];
const ICECREAM = [["Small", 150], ["Large", 200]];
const SALAD = [["Small", 300], ["Medium", 500], ["Large", 750]];

// simple single-price item
const one = (name, price, kw, extra = {}) => ({ name, price, kw, ...extra });
// multi-size product -> expands to rows sharing group_key
const sized = (name, sizes, kw, extra = {}) => ({ name, sizes, kw, ...extra });

const CATEGORIES = [
  { name: "Pizzas", tab: "Pizzas", items: [
    sized("Chicken Tikka Pizza", CLASSIC, "pizza", { description: "Chicken Tikka, Onion, Tomato, Cheese" }),
    sized("Chicken Fajita Pizza", CLASSIC, "pizza", { description: "Onion, Tomato, Capsicum, Jalapeno, Chicken Fajita, Cheese" }),
    sized("Tandoori Pizza", CLASSIC, "pizza", { description: "Tandoori Chicken, Tomato, Onion, Mushroom, Cheese" }),
    sized("Hot-N-Spicy Pizza", CLASSIC, "pizza", { description: "Spicy Chicken, Onion, Spicy Herbs, Cheese, Jalapeno, Tomato" }),
    sized("Chicken Achari Pizza", CLASSIC, "pizza", { description: "Cheese, Achari Chicken, Onion, Capsicum, Olives" }),
    sized("Vege Lover Pizza", CLASSIC, "pizza", { description: "Cheddar, Mozzarella, Onion, Tomato, Capsicum, Jalapeno, Sweet Corn, Olives, Mushroom" }),
    sized("Chicken Supreme Pizza", CLASSIC, "pizza", { description: "Cheese, Onion, Chicken, Tomato, Capsicum, Olives" }),
    sized("Cheesy Gold Pizza", CLASSIC, "pizza", { description: "Mozzarella Cheese, Tomato, Oregano Sauce" }),
  ]},
  { name: "Spice Special Pizzas", tab: "Pizzas", items: [
    sized("Spice Special Pizza", SPECIAL, "pizza"),
    sized("Behari Kabab Pizza", SPECIAL, "pizza"),
    sized("Stuffed Crust Pizza", SPECIAL, "pizza"),
    sized("Crown Crust Pizza", SPECIAL, "pizza"),
    sized("Fajita Sicilian Pizza", SPECIAL, "pizza"),
    sized("Kababish Pizza", SPECIAL, "pizza"),
    sized("Legend Malai Pizza", SPECIAL, "pizza"),
    sized("Super Supreme Pizza", SPECIAL, "pizza"),
    sized("Cheese Stuffed Pizza", SPECIAL, "pizza"),
    sized("Cheeze Creamy Pizza", SPECIAL, "pizza"),
    sized("Chapli Kabab Pizza", SPECIAL, "pizza"),
    sized("Round Kabab Pizza", SPECIAL, "pizza"),
    sized("Zinger Fried Pizza", SPECIAL, "pizza"),
    sized("Pasta Pizza", SPECIAL, "pizza"),
  ]},
  { name: "Square Pizza", tab: "Pizzas", items: [ sized("Square Pizza", SQUARE, "pizza,square") ]},
  { name: "Double / Four Flavour", tab: "Pizzas", items: [
    sized("Double Flavour Pizza", FLAVOUR, "pizza"),
    sized("Four Flavour Pizza", FLAVOUR, "pizza"),
  ]},
  { name: "Cheese Sticks", tab: "Sides", items: [
    one("Special Cheese Stick", 650, "cheese,bread"),
    one("Cheese Stick", 550, "cheese,bread"),
    one("Garlic Cheese Stick", 600, "garlic,bread"),
    one("Kababish Cheese Stick", 650, "cheese,bread"),
    one("BBQ Cheese Stick", 600, "cheese,bread"),
    one("Crunchy Cheese Stick", 650, "cheese,bread"),
    one("Crown Cheese Stick", 1100, "cheese,bread"),
    one("Chicken Cheese Boll (5 Pcs)", 400, "cheese,ball"),
  ]},
  { name: "Special Pasta", tab: "Sides", items: [
    one("Flaming Pasta", 650, "pasta"),
    one("Creamy Pasta", 650, "pasta"),
    one("Crunchy Pasta", 699, "pasta"),
    one("Kababish Pasta", 699, "pasta"),
    one("Matka Fries", 699, "fries"),
    one("Matka Pasta", 699, "pasta"),
  ]},
  { name: "Burgers", tab: "Burgers", items: [
    one("Zinger Burger", 380, "burger"),
    one("Chicken Burger", 280, "burger"),
    one("Chapli Burger", 300, "burger"),
    one("Sub Burger", 250, "burger,sub"),
    one("Tower Burger", 600, "burger"),
    one("Cheezy Chicken Burger", 350, "burger,cheese"),
    one("Red Burger", 380, "burger"),
    one("Black Burger", 380, "burger"),
    one("Filler Burger", 550, "burger"),
    one("Cheezy Lawa Zinger", 550, "burger,cheese"),
    one("Egg Burger", 150, "burger,egg"),
    one("Double Egg Burger", 200, "burger,egg"),
    one("Chicken Burger (Single Egg)", 230, "burger,egg"),
    one("Chicken Burger (Double Egg)", 280, "burger,egg"),
  ]},
  { name: "Rolls", tab: "Rolls", items: [
    one("Shawarma Roll", 220, "shawarma,wrap"),
    one("Cheeze Shawarma Roll", 280, "shawarma,wrap"),
    one("Zinger Shawarma Roll", 280, "shawarma,wrap"),
    one("Zinger Pratha Roll", 299, "wrap,roll"),
    one("Chicken Pratha Roll", 260, "wrap,roll"),
    one("Kabab Pratha Roll", 299, "wrap,roll"),
    one("Open Shawarma", 500, "shawarma"),
  ]},
  { name: "Chicken", tab: "Sides", items: [
    one("Hot Wings (5 Pcs)", 270, "chicken,wings"),
    one("Hot Wings (10 Pcs)", 550, "chicken,wings"),
    one("Nuggets (5 Pcs)", 270, "nuggets"),
    one("Nuggets (10 Pcs)", 499, "nuggets"),
    one("Hot Shot (15 Pcs)", 500, "fried,chicken"),
  ]},
  { name: "Fries", tab: "Sides", items: [
    one("Regular Fries", 160, "fries"),
    one("Large Fries", 230, "fries"),
    one("Family Fries", 400, "fries"),
    one("Mayo Fries", 450, "fries"),
    one("Loaded Fries", 600, "loaded,fries"),
  ]},
  { name: "Platters", tab: "Sides", items: [
    one("Turkish Platter", 600, "platter,food"),
    one("Pizza Paratha", 600, "pizza,paratha"),
  ]},
  { name: "Family Deals", tab: "Deals", items: [
    one("Family Deal-01", 5500, "combo,feast", { description: "2 Medium Pizza, 6 Zinger Burger, 10 Pcs Hot Wings, 3 Large Fries, 1.5 Ltr Drink, 1 Cake" }),
    one("Family Deal-02", 1200, "combo,pizza", { description: "2 Small Pizza, 1 Ltr Drink" }),
    one("Family Deal-03", 2050, "combo,pizza", { description: "2 Medium Pizza, 1.5 Ltr Drink" }),
    one("Family Deal-04", 2600, "combo,pizza", { description: "2 Large Pizza, 1.5 Ltr Drink" }),
    one("Family Deal-05", 2900, "combo,pizza", { description: "2 Family Pizza, 1.5 Ltr Drink" }),
    one("Family Deal-06", 1900, "combo,pizza", { description: "2 Small Pizza, 2 Zinger Burger, 1 Ltr Drink" }),
    one("Family Deal-07", 1950, "combo,pizza", { description: "1 Large Pizza, 10 Pcs Hot Wings, 1.5 Ltr Drink" }),
    one("Family Deal-08", 1400, "combo,wrap", { description: "5 Tikka Pratha Roll, 1 Ltr Drink" }),
    one("Family Deal-09", 1200, "combo,shawarma", { description: "5 Shawarma Roll, 1 Ltr Drink" }),
    one("Family Deal-10", 2100, "combo,burger", { description: "5 Zinger Burger, 1 Family Fries, 1.5 Ltr Drink" }),
    one("Family Deal-11", 1200, "combo,burger", { description: "3 Zinger Burger, 1 Ltr Drink" }),
    one("Family Deal-12", 2200, "combo,pizza", { description: "Special Family Pizza, 5 Pcs Nuggets, 1.5 Ltr Drink" }),
    one("Family Deal-13", 2100, "combo,pizza", { description: "Family Pizza, 10 Pcs Nuggets, 1.5 Ltr Drink" }),
  ]},
  { name: "Regular Deals", tab: "Deals", items: [
    one("Regular Deal-01", 470, "combo,burger", { description: "1 Chicken Burger, 1 Reg Drink, 1 Reg Fries" }),
    one("Regular Deal-02", 500, "combo,burger", { description: "1 Chapli Burger, 1 Reg Drink, 1 Reg Fries" }),
    one("Regular Deal-03", 550, "combo,burger", { description: "1 Zinger Burger, 1 Reg Drink, 1 Reg Fries" }),
    one("Regular Deal-04", 1100, "combo,burger", { description: "2 Zinger Burger, 2 Reg Drink, 2 Reg Fries" }),
    one("Regular Deal-05", 580, "combo,wrap", { description: "2 Tikka Pratha, 1x500ml Drink" }),
    one("Regular Deal-06", 500, "combo,shawarma", { description: "2 Shawarma Roll, 1x500ml Drink" }),
    one("Regular Deal-07", 580, "combo,cheese", { description: "1 Cheese Stick, 1 Reg Drink" }),
    one("Regular Deal-08", 600, "combo,pizza", { description: "1 Small Pizza, 1 Reg Drink" }),
    one("Regular Deal-09", 550, "combo,chicken", { description: "15 Pcs Hot Shots, 1 Reg Drink" }),
    one("Regular Deal-10", 600, "combo,wings", { description: "10 Pcs Hot Wings, 1 Reg Drink" }),
    one("Regular Deal-11", 550, "combo,wings", { description: "10 Pcs BBQ Wings, 1 Reg Drink" }),
    one("Regular Deal-12", 550, "combo,wings", { description: "10 Pcs Honey Wings, 1 Reg Drink" }),
    one("Regular Deal-13", 550, "combo,nuggets", { description: "10 Pcs Nuggets, 1 NR Drink" }),
    one("Regular Deal-14", 1100, "combo,burger", { description: "2 Zinger Burger, 5 Pcs Wings, 1 Ltr Drink" }),
  ]},
  { name: "Drinks", tab: "Drinks", items: [
    one("NR Drink", 80, "soft-drink,cola"),
    one("Half Ltr Drink", 110, "soft-drink,cola"),
    one("1 Ltr Drink", 150, "soft-drink,cola"),
    one("1.5 Ltr Drink", 200, "soft-drink,cola"),
    one("Mineral Water (Small)", 60, "water,bottle"),
    one("Mineral Water (Large)", 120, "water,bottle"),
  ]},
  { name: "Spice Ice Shake", tab: "Drinks", items:
    ["Pista","Kulfa","Strawberry","Vanilla","Chocolate","Mango","Oreo","Cramel Crunch","Kit Kat"]
      .map((f) => one(`${f} Ice Shake`, 450, "milkshake")) },
  { name: "Fresh Shake", tab: "Drinks", items:
    ["Mango","Peach","Falsa","Strawberry","Mint Margarita","Strawberry Margarita"]
      .map((f) => one(`${f} Fresh Shake`, 350, "smoothie,juice")) },
  { name: "Ice Cream", tab: "Desserts", items:
    ["Strawberry","Kulfa","Mango","Chocolate","Vanilla","Pista","Cramel Crunch"]
      .map((f) => sized(`${f} Ice Cream`, ICECREAM, "ice-cream")) },
  { name: "Russian Salad", tab: "Sides", items: [ sized("Russian Salad", SALAD, "salad") ]},
];

const MODIFIERS = ["Extra spicy", "No onion", "Extra cheese", "Less spicy", "Extra topping", "Well done"];

const TABLES = [1, 2, 3, 4, 5, 6];

const STAFF = [
  { name: "Bilal", email: "owner@spicepizza.local", role: "owner", pin: "1234" },
  { name: "AK", email: "counter@spicepizza.local", role: "counter_staff" },
];

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) { console.error(`✗ ${label}:`, error.message); process.exit(1); }
  return data;
}

async function main() {
  // settings singleton
  await must("settings", supa.from("settings").upsert({ id: 1 }, { onConflict: "id" }).select());

  // staff
  for (const s of STAFF) await must(`staff ${s.name}`, supa.from("staff").upsert(s, { onConflict: "email" }).select());

  // tables
  for (const n of TABLES) await must(`table ${n}`, supa.from("restaurant_tables").upsert({ number: n, seats: 4 }, { onConflict: "number" }).select());

  // global modifiers (skip if already present)
  const existingMods = await must("check modifiers", supa.from("menu_item_modifiers").select("id").is("menu_item_id", null).is("group_key", null).limit(1));
  if (!existingMods.length) {
    await must("modifiers", supa.from("menu_item_modifiers").insert(MODIFIERS.map((label, i) => ({ label, sort_order: i }))).select());
  }

  // menu
  const existingCats = await must("check categories", supa.from("menu_categories").select("id").limit(1));
  if (existingCats.length && !RESET) {
    console.log("Menu already seeded — pass --reset to wipe and reseed. Skipping menu.");
  } else {
    if (RESET) {
      await must("wipe menu", supa.from("menu_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
      console.log("Wiped existing menu.");
    }
    let itemRows = [];
    let catSort = 0;
    for (const cat of CATEGORIES) {
      const [row] = await must(`category ${cat.name}`,
        supa.from("menu_categories").insert({ name: cat.name, tab_group: cat.tab, sort_order: catSort++ }).select());
      let sort = 0;
      for (const it of cat.items) {
        const groupKey = slug(cat.name) + "__" + slug(it.name);
        const p = photo(it.kw);
        if (it.sizes) {
          for (const [size_label, price] of it.sizes) {
            itemRows.push({ category_id: row.id, group_key: groupKey, name: it.name, size_label, price,
              description: it.description ?? null, photo_url: p, is_placeholder: true, sort_order: sort });
          }
        } else {
          itemRows.push({ category_id: row.id, group_key: groupKey, name: it.name, size_label: null, price: it.price,
            description: it.description ?? null, photo_url: p, is_placeholder: true, sort_order: sort });
        }
        sort++;
      }
    }
    // batch insert items
    for (let i = 0; i < itemRows.length; i += 100) {
      await must(`items ${i}`, supa.from("menu_items").insert(itemRows.slice(i, i + 100)).select("id"));
    }
    console.log(`Inserted ${itemRows.length} menu item rows across ${CATEGORIES.length} categories.`);
  }

  console.log("✓ Seed complete.");
}

main();
