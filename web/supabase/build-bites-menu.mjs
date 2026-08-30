import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const esc = (s) => String(s).replace(/'/g, "''");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const cats = [];
const items = [];
let csort = 0;
let isort = 0;
function cat(name, tab) { const id = randomUUID(); cats.push({ id, name, tab, sort: ++csort }); return id; }
function item(catId, group, name, size, price, desc = null) {
  items.push({ id: randomUUID(), cat: catId, group, name, size, price, desc, sort: ++isort });
}
function simple(catId, arr) { for (const it of arr) item(catId, slug(it.name), it.name, null, it.price, it.desc ?? null); }
function sized(catId, name, sizes, desc = null) { const g = slug(name); for (const s of sizes) item(catId, g, name, s.size, s.price, desc); }
function pizzaList(catId, sizePricing, list) {
  for (const p of list) { const g = slug(p.name); for (const s of sizePricing) item(catId, g, p.name, s.size, s.price, p.ingredients ?? null); }
}

// ---------- PIZZA ----------
pizzaList(cat("Classic Pizza", "Pizza"),
  [{ size: "Small", price: 500 }, { size: "Medium", price: 900 }, { size: "Large", price: 1450 }, { size: "Family", price: 1850 }],
  [{ name: "Chicken Tikka" }, { name: "Chicken Fajita" }, { name: "Hot & Spicy" }, { name: "Vegetarian Pizza" }]);

pizzaList(cat("Special Pizza", "Pizza"),
  [{ size: "Medium", price: 1100 }, { size: "Large", price: 1600 }, { size: "Family", price: 2100 }],
  [{ name: "Bite Special Pizza" }, { name: "Malai Boti Pizza" }, { name: "Cheese Stuff Pizza" }, { name: "Crown Crust Pizza" },
   { name: "Kababish Pizza" }, { name: "Carzon Pizza" }, { name: "Cheese Steak" }]);

simple(cat("Train Pizza", "Pizza"), [{ name: "Special Train Pizza", price: 3700 }]);

// ---------- DEALS ----------
const deals = cat("Family Deals", "Deals");
for (const d of [
  ["Family Deal-01", "1 Zinger Burger, 1 Reg Fries, 1 NR Drink", 550],
  ["Family Deal-02", "1 Zinger Burger, 1 Petty Burger, 1 Reg Fries, 1 Ltr Drink", 899],
  ["Family Deal-03", "4 Zinger Burger, 1 Reg Fries, 1 1.5 Ltr Drink", 1899],
  ["Family Deal-04", "2 Zinger Shawarma, 1 Zinger Burger, 1 Petty Burger, 1 Ltr Drink", 1199],
  ["Family Deal-05", "1 Small Pizza, 2 Zinger Burger, 1 Reg Fries, 1 Ltr Drink", 1499],
  ["Family Deal-06", "2 Small Pizza, 1 Ltr Drink", 1050],
  ["Family Deal-07", "1 Large Pizza, 2 Zinger Burger, 1 Reg Fries, 1 1.5 Ltr Drink", 2750],
  ["Family Deal-08", "2 Large Pizza, 10 Pcs Nuggets, 1 1.5 Ltr Drink", 3150],
  ["Family Deal-09", "2 Medium Pizza, 1 1.5 Ltr Drink", 1799],
  ["Family Deal-10", "2 Family Pizza, 1 1.5 Ltr Drink", 3599],
  ["Family Deal-11", "1 Small Pizza, 2 Zinger Burger, 1 Reg Fries, 1 Ltr Drink", 1050],
  ["Family Deal-12", "10 Pcs Nuggets, 1 NR Drink", 500],
]) item(deals, slug(d[0]), d[0], null, d[2], d[1]);

// ---------- FAST FOOD ----------
simple(cat("Burgers", "Fast Food"), [
  { name: "Shami Burger", price: 200 }, { name: "Zinger Burger", price: 450 }, { name: "Zinger Cheese Burger", price: 500 },
  { name: "Chicken Petty Burger", price: 300 }, { name: "Cheese Petty Burger", price: 350 },
]);

const shawarma = cat("Shawarma", "Fast Food");
sized(shawarma, "Chicken Shawarma", [{ size: "Small", price: 200 }, { size: "Large", price: 250 }]);
simple(shawarma, [
  { name: "Chicken Cheese Shawarma", price: 300 }, { name: "Malai Boti Shawarma", price: 350 },
  { name: "Zinger Shawarma", price: 450 }, { name: "Open Shawarma", price: 550, desc: "Extra Bread 40" },
]);

simple(cat("Wings", "Fast Food"), [{ name: "Crispy Wings (5 Pcs)", price: 400 }, { name: "Crispy Wings (10 Pcs)", price: 700 }]);

// ---------- SIDES ----------
const fp = cat("Fries & Pasta", "Sides");
sized(fp, "French Fries", [{ size: "Small", price: 200 }, { size: "Large", price: 350 }]);
sized(fp, "Loaded Fries", [{ size: "Small", price: 400 }, { size: "Large", price: 700 }]);
sized(fp, "Kababish Pasta", [{ size: "Small", price: 400 }, { size: "Large", price: 700 }]);
sized(fp, "Creamy Pasta", [{ size: "Small", price: 400 }, { size: "Large", price: 700 }]);
sized(fp, "Crunchy Pasta", [{ size: "Small", price: 450 }, { size: "Large", price: 700 }]);

// ---------- BEVERAGES (prices not on the flyer — set sensible defaults; owner can edit in Admin) ----------
simple(cat("Drinks", "Beverages"), [
  { name: "NR Drink", price: 80 }, { name: "Regular Drink", price: 100 }, { name: "1 Ltr Drink", price: 160 }, { name: "1.5 Ltr Drink", price: 220 },
]);

// ---------- emit SQL ----------
const catVals = cats.map((c) => `('${c.id}','${esc(c.name)}','${esc(c.tab)}',${c.sort})`).join(",\n");
const itemVals = items.map((i) =>
  `('${i.id}','${i.cat}','${esc(i.group)}','${esc(i.name)}',${i.size ? `'${esc(i.size)}'` : "null"},${i.price},${i.desc ? `'${esc(i.desc)}'` : "null"},true,false,${i.sort})`
).join(",\n");

const sql = `begin;
update order_line_items set menu_item_id = null;
delete from menu_item_modifiers where menu_item_id is not null;
delete from menu_items;
delete from menu_categories;
insert into menu_categories (id,name,tab_group,sort_order) values
${catVals};
insert into menu_items (id,category_id,group_key,name,size_label,price,description,is_live,is_placeholder,sort_order) values
${itemVals};
update settings set
  brand_name='Bites Pizza',
  receipt_tagline='Pizza & Fast Food',
  receipt_address='Thatha Faqir Ullah, Near Masjid Faiz-e-Madina, Wazirabad.',
  receipt_phone='0311-7677560',
  receipt_footer='Free Home Delivery  -  Thank you!'
where id=1;
commit;
`;
writeFileSync(new URL("./bites-menu-seed.sql", import.meta.url), sql);
console.log(`categories=${cats.length} items=${items.length}`);
