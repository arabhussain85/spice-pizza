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
function flavorProduct(catId, name, list, price, clean = (x) => x) { const g = slug(name); for (const f of list) item(catId, g, name, clean(f), price); }

// ---------- PIZZA ----------
const pizzasSizes = [{ size: "Small", price: 550 }, { size: "Medium", price: 1050 }, { size: "Large", price: 1350 }, { size: "Family", price: 1550 }];
pizzaList(cat("Pizzas", "Pizza"), pizzasSizes, [
  { name: "Chicken Tikka", ingredients: "Chicken Tikka, Onion, Tomato, Cheese" },
  { name: "Chicken Fajita", ingredients: "Onion, Tomato, Capsicum, Jalapeno, Chicken Fajita, Cheese" },
  { name: "Tandoori Pizza", ingredients: "Tandoori Chicken, Tomato, Onion, Mushroom, Cheese" },
  { name: "Hot-N-Spicy", ingredients: "Spicy Chicken, Onion, Spicy Herbs, Cheese, Jalapeno, Tomato" },
  { name: "Chicken Achari Pizza", ingredients: "Cheese, Achari Chicken, Onion, Capsicum, Olives" },
  { name: "Vege Lover Pizza", ingredients: "Cheddar Cheese, Mozzarella Cheese, Onion, Tomato, Capsicum, Jalapeno, Sweet Corn, Black Olives, Mushroom, Chef Sauce" },
  { name: "Chicken Supreme Pizza", ingredients: "Cheese, Onion, Chicken, Tomato, Capsicum, Olives, Smoked, Veal" },
  { name: "Cheesy Gold Pizza", ingredients: "Mozzarella Cheese, Tomato, Oregano Sauce" },
]);

const spiceSizes = [{ size: "Medium", price: 1350 }, { size: "Large", price: 1550 }, { size: "Family", price: 1850 }];
pizzaList(cat("Spice Special Pizza", "Pizza"), spiceSizes, [
  { name: "Spice Special Pizza", ingredients: "Special Chicken, Mushroom, Sweet Corn, Sausage, Tomato, Onion, Capsicum, Double Cheese, Pizza Sauce, Oregano" },
  { name: "Behari Kabab Pizza", ingredients: "2 Type Of Chicken, Mushroom, Sweet Corn, Olives, Sausage, Tomato, Onion" },
  { name: "Stuffed Crust Pizza", ingredients: "Round Kabab, Chicken, Mushroom, Sweet Corn, Olives, Spicy Sauce, Double Cheese, Pizza Sauce" },
  { name: "Crown Crust Pizza", ingredients: "2 Type Of Chicken, Seekh Kabab, Mushroom, Sweet Corn, Olives, Tomato, Onion, Capsicum, Double Cheese, Pizza Sauce, Oregano" },
  { name: "Fajita Sicilian", ingredients: "Smoked Chicken, Mushroom, Sweet Corn, Olives, Sauce, Tomato, Onion, Capsicum, Double Cheese, Pizza Sauce, Oregano" },
  { name: "Kababish Pizza", ingredients: "Chicken Kabab, Garlic Chicken, Capsicum, Onion, Pizza Sauce, Tomato, Cheese, Oregano" },
  { name: "Legend Malai Pizza", ingredients: "Malai Boti Chicken, Mushroom, Sweet Corn, Olives, Sauce, Tomato, Onion, Capsicum, Double Cheese, Pizza Sauce, Oregano" },
  { name: "Super Supreme Pizza", ingredients: "Supreme Chicken & Sauce, Mushroom, Sweet Corn, Olives, Tomato, Onion, Capsicum, Double Cheese, Pizza Sauce, Oregano" },
  { name: "Cheese Stuffed Pizza", ingredients: "Special Chicken, Mushroom, Sweet Corn, Olives, Sausage, Capsicum, Double Cheese, Pizza Sauce, Oregano" },
  { name: "Cheeze Creamy Pizza", ingredients: "Special Chicken, Cheese, Cream" },
  { name: "Chapli Kabab Pizza", ingredients: "Chapli Kabab, Cheese" },
  { name: "Round Kabab Pizza", ingredients: "Kabab, Cheese" },
  { name: "Zinger Fried Pizza", ingredients: "Zinger, Cheese" },
  { name: "Pasta Pizza", ingredients: "Macaroni" },
]);

sized(cat("Square Pizza", "Pizza"), "Square Pizza", [{ size: "Small", price: 900 }, { size: "Medium", price: 1500 }, { size: "Large", price: 2000 }, { size: "Family", price: 2300 }]);
sized(cat("Double Flavour Pizza", "Pizza"), "Double Flavour Pizza", spiceSizes);
sized(cat("Four Flavour Pizza", "Pizza"), "Four Flavour Pizza", spiceSizes);
simple(cat("Burger Pizza", "Pizza"), [{ name: "Burger Pizza (Small)", price: 750 }]);
sized(cat("Add-ons", "Pizza"), "Extra Topping", [{ size: "Small", price: 99 }, { size: "Medium", price: 149 }, { size: "Large", price: 199 }, { size: "Family", price: 249 }], "Add to any pizza");

// ---------- DEALS ----------
const fam = cat("Family Deals", "Deals");
for (const d of [
  ["Family Deal-01", "2 Medium Pizza, 6 Zinger Burger, 10 Pcs Hot Wings, 3 Large Fries, 1.5 Ltr Drink, 1 Cake", 5500],
  ["Family Deal-02", "2 Small Pizza, 1 Ltr Drink", 1200],
  ["Family Deal-03", "2 Medium Pizza, 1.5 Ltr Drink", 2050],
  ["Family Deal-04", "2 Large Pizza, 1.5 Ltr Drink", 2600],
  ["Family Deal-05", "2 Family Pizza, 1.5 Ltr Drink", 2900],
  ["Family Deal-06", "2 Small Pizza, 2 Zinger Burger, 1 Ltr Drink", 1900],
  ["Family Deal-07", "1 Large Pizza, 10 Pcs Hot Wings, 1.5 Ltr Drink", 1950],
  ["Family Deal-08", "5 Tikka Pratha Roll, 1 Ltr Drink", 1400],
  ["Family Deal-09", "5 Shawarma Roll, 1 Ltr Drink", 1200],
  ["Family Deal-10", "5 Zinger Burger, 1 Family Fries, 1.5 Ltr Drink", 2100],
  ["Family Deal-11", "3 Zinger Burger, 1 Ltr Drink", 1200],
  ["Family Deal-12", "Special Family Pizza, 5 Pcs Nuggets, 1.5 Ltr Drink", 2200],
  ["Family Deal-13", "Family Pizza, 10 Pcs Nuggets, 1.5 Ltr Drink", 2100],
  ["Birthday Deal", "2 Large Pizza, 2 Cheese Stick, 2 Large Fries, 10 Hot Wings, 6 Zinger Burger, 1 Creamy Pasta, 2 (1.5 Ltr) Drink, 1 Pound Cake", 7500],
]) item(fam, slug(d[0]), d[0], null, d[2], d[1]);

const reg = cat("Regular Deals", "Deals");
for (const d of [
  ["Regular Deal-01", "1 Chicken Burger, 1 Reg Drink, 1 Reg Fries", 470],
  ["Regular Deal-02", "1 Chapli Burger, 1 Reg Drink, 1 Reg Fries", 500],
  ["Regular Deal-03", "1 Zinger Burger, 1 Reg Drink, 1 Reg Fries", 550],
  ["Regular Deal-04", "2 Zinger Burger, 2 Reg Drink, 2 Reg Fries", 1100],
  ["Regular Deal-05", "2 Tikka Pratha, 1 (500ml) Drink", 580],
  ["Regular Deal-06", "2 Shawarma Roll, 1 (500ml) Drink", 500],
  ["Regular Deal-07", "1 Cheese Stick, 1 Reg Drink", 580],
  ["Regular Deal-08", "1 Small Pizza, 1 Reg Drink", 600],
  ["Regular Deal-09", "15 Pcs Hot Shots, 1 Reg Drink", 550],
  ["Regular Deal-10", "10 Pcs Hot Wings, 1 Reg Drink", 600],
  ["Regular Deal-11", "10 Pcs BBQ Wings, 1 Reg Drink", 550],
  ["Regular Deal-12", "10 Pcs Honey Wings, 1 Reg Drink", 550],
  ["Regular Deal-13", "10 Pcs Nuggets, 1 NR Drink", 550],
  ["Regular Deal-14", "2 Zinger Burger, 5 Pcs Wings, 1 Ltr Drink", 1100],
]) item(reg, slug(d[0]), d[0], null, d[2], d[1]);

// ---------- FAST FOOD ----------
simple(cat("Burgers", "Fast Food"), [
  { name: "Zinger Burger", price: 380 }, { name: "Chicken Burger", price: 280 }, { name: "Chapli Burger", price: 300 },
  { name: "Sub Burger", price: 250 }, { name: "Tower Burger", price: 600 }, { name: "Cheezy Chicken Burger", price: 350 },
  { name: "Red Burger", price: 380 }, { name: "Black Burger", price: 380 }, { name: "Filler Burger", price: 550 },
  { name: "Cheezy Lawa Zinger", price: 550 }, { name: "Egg Burger", price: 150 }, { name: "Double Egg Burger", price: 200 },
  { name: "Chicken Burger (Single Egg)", price: 230 }, { name: "Chicken Burger (Double Egg)", price: 280 },
]);
simple(cat("Rolls", "Fast Food"), [
  { name: "Shawarma Roll", price: 220 }, { name: "Cheeze Shawarma Roll", price: 280 }, { name: "Zinger Shawarma Roll", price: 280 },
  { name: "Zinger Pratha Roll", price: 299 }, { name: "Chicken Pratha Roll", price: 260 }, { name: "Kabab Pratha Roll", price: 299 },
  { name: "Open Shawarma", price: 500 },
]);
simple(cat("Wraps", "Fast Food"), [{ name: "Tortilla Wrap", price: 550 }, { name: "Zinger Wrap", price: 550 }, { name: "B.B.Q Grill Wrap", price: 550 }]);
simple(cat("Grilled", "Fast Food"), [{ name: "Grilled Shawarma", price: 380 }, { name: "Grilled Paratha", price: 380 }]);
simple(cat("Chicken", "Fast Food"), [
  { name: "Hot Wings (10 pcs)", price: 550 }, { name: "Hot Wings (5 pcs)", price: 270 }, { name: "Nuggets (10 pcs)", price: 499 },
  { name: "Nuggets (5 pcs)", price: 270 }, { name: "Hot Shot (15 pcs)", price: 500 },
]);
simple(cat("Fries", "Fast Food"), [
  { name: "Reg. Fries", price: 160 }, { name: "Large Fries", price: 230 }, { name: "Family Fries", price: 400 },
  { name: "Mayo Fries", price: 450 }, { name: "Loaded Fries", price: 600 },
]);
simple(cat("Grill", "Fast Food"), [
  { name: "Grill Fries", price: 700 }, { name: "Zinger Fries", price: 700 }, { name: "Cheezy Grilled Wings", price: 700 }, { name: "B.B.Q Grill Wings", price: 650 },
]);
simple(cat("Grilled Wings", "Fast Food"), [
  { name: "Garlic Grilled Wings", price: 650 }, { name: "Chicken Grilled Wings", price: 600 }, { name: "Turkish Durum", price: 500 },
]);
simple(cat("Platter", "Fast Food"), [{ name: "Turkish Platter", price: 600 }, { name: "Pizza Paratha", price: 600 }]);

// ---------- SIDES ----------
simple(cat("Special Pasta", "Sides"), [
  { name: "Flaming Pasta", price: 650 }, { name: "Creamy Pasta", price: 650 }, { name: "Crunchy Pasta", price: 699 },
  { name: "Kababish Pasta", price: 699 }, { name: "Matka Fries", price: 699 }, { name: "Matka Pasta", price: 699 },
]);
simple(cat("Cheese Stick", "Sides"), [
  { name: "Special Cheese Stick", price: 650 }, { name: "Cheese Stick", price: 550 }, { name: "Garlic Cheese Stick", price: 600 },
  { name: "Kababish Cheese Stick", price: 650 }, { name: "BBQ Cheese Stick", price: 600 }, { name: "Crunchy Cheese Stick", price: 650 },
  { name: "Crown Cheese Stick", price: 1100 }, { name: "Chicken Cheese Boll (5 Pcs)", price: 400 },
]);
sized(cat("Russian Salad", "Sides"), "Russian Salad", [{ size: "Small", price: 300 }, { size: "Medium", price: 500 }, { size: "Large", price: 750 }]);
simple(cat("Rice", "Sides"), [{ name: "Chomien", price: 500 }, { name: "Egg Rice", price: 350 }, { name: "Fried Rice & Manchurian", price: 450 }]);
simple(cat("Fish", "Sides"), [
  { name: "Finger Fish (1 Kg)", price: 2800 }, { name: "Finger Fish (500 Gram)", price: 1500 },
  { name: "Grill Fish (1 Kg)", price: 3200 }, { name: "Grill Fish (500 Gram)", price: 1600 },
]);
simple(cat("Snacks", "Sides"), [{ name: "Fish Cracker", price: 150 }]);
simple(cat("Sweets", "Sides"), [{ name: "Molten Lava", price: 550 }]);

// ---------- BEVERAGES ----------
const drinks = cat("Drinks", "Beverages");
simple(drinks, [{ name: "NR Drink", price: 80 }, { name: "Half Ltr Drink", price: 110 }, { name: "1 Ltr Drink", price: 150 }, { name: "1.5 Ltr Drink", price: 200 }]);
sized(drinks, "Mineral Water", [{ size: "Small", price: 60 }, { size: "Large", price: 120 }]);
flavorProduct(cat("Spice Ice Shake", "Beverages"), "Spice Ice Shake",
  ["Pista Ice Shake", "Kulfa Ice Shake", "Strawberry Shake", "Vanilla Ice Shake", "Chocolate Ice Shake", "Mango Ice Shake", "Oreo Shake", "Caramel Crunch Shake", "Kit Kat Ice Shake"],
  450, (f) => f.replace(/\s*(ice\s*)?shake$/i, "").trim());
flavorProduct(cat("Fresh Shake", "Beverages"), "Fresh Shake", ["Mango", "Peach", "Falsa", "Strawberry", "Mint Margarita", "Strawberry Margarita"], 350);
const ic = cat("Ice Cream", "Beverages");
for (const f of ["Strawberry", "Kulfa", "Mango", "Chocolate", "Vanilla", "Pista", "Caramel Crunch"]) {
  const g = slug("ice cream " + f);
  item(ic, g, f + " Ice Cream", "Single", 150);
  item(ic, g, f + " Ice Cream", "Double", 200);
}
simple(cat("Soup & Beverages", "Beverages"), [{ name: "Soup", price: 150 }, { name: "Tea", price: 120 }, { name: "Coffee", price: 200 }]);

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
  brand_name='Spice Pizza',
  receipt_tagline='Best Food in Town',
  receipt_address='A-One Market Opp. Dhoniki Phatak, Ahmad Nagar Road Wazirabad.',
  receipt_phone='0341-6297065 / WhatsApp 0313-6597065',
  receipt_footer='Fast & Free Delivery  -  Follow us @spicepizza'
where id=1;
commit;
`;
writeFileSync(new URL("./menu-seed.sql", import.meta.url), sql);
console.log(`categories=${cats.length} items=${items.length}`);
