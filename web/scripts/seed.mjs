// Seed Spice Pizza reference data over HTTPS (service role — bypasses RLS).
// Fast parallel photo URL batch updater.
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env");
const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const FOOD_PHOTOS = {
  pizza: [
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1528137871618-79d2761e3fd5?auto=format&fit=crop&w=600&q=80",
  ],
  burger: [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1582196016295-f8c8bd4b3a99?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=600&q=80",
  ],
  pasta: [
    "https://images.unsplash.com/photo-1621996346565-e3d5d6281270?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  ],
  fries: [
    "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1630384060421-cb3f1b528b8d?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80",
  ],
  roll: [
    "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&w=600&q=80",
  ],
  wings: [
    "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80",
  ],
  shake: [
    "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
  ],
  drink: [
    "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1543253687-c931c8e01820?auto=format&fit=crop&w=600&q=80",
  ],
  icecream: [
    "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1560008511-11c63416e52d?auto=format&fit=crop&w=600&q=80",
  ],
  cheese: [
    "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1619860860774-1e2e17343432?auto=format&fit=crop&w=600&q=80",
  ],
  deal: [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
  ],
};

let photoIndices = {};
function getPhoto(name) {
  const n = name.toLowerCase();
  let list = FOOD_PHOTOS.pizza;
  if (n.includes("burger")) list = FOOD_PHOTOS.burger;
  else if (n.includes("pasta")) list = FOOD_PHOTOS.pasta;
  else if (n.includes("fries")) list = FOOD_PHOTOS.fries;
  else if (n.includes("roll") || n.includes("wrap") || n.includes("shawarma") || n.includes("pratha")) list = FOOD_PHOTOS.roll;
  else if (n.includes("wing") || n.includes("nugget") || n.includes("chicken") || n.includes("shot")) list = FOOD_PHOTOS.wings;
  else if (n.includes("shake") || n.includes("smoothie") || n.includes("juice") || n.includes("margarita")) list = FOOD_PHOTOS.shake;
  else if (n.includes("drink") || n.includes("water") || n.includes("cola")) list = FOOD_PHOTOS.drink;
  else if (n.includes("ice") || n.includes("cream") || n.includes("salad")) list = FOOD_PHOTOS.icecream;
  else if (n.includes("cheese") || n.includes("bread") || n.includes("garlic") || n.includes("stick")) list = FOOD_PHOTOS.cheese;
  else if (n.includes("deal") || n.includes("combo") || n.includes("platter")) list = FOOD_PHOTOS.deal;

  const idx = (photoIndices[n] || 0) % list.length;
  photoIndices[n] = idx + 1;
  return list[idx];
}

async function main() {
  console.log("Fetching menu items…");
  const { data: items, error } = await supa.from("menu_items").select("id, name");
  if (error) throw error;

  console.log(`Updating ${items.length} menu items in parallel batches…`);
  const batchSize = 25;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(
      chunk.map((item) =>
        supa
          .from("menu_items")
          .update({ photo_url: getPhoto(item.name), is_placeholder: false })
          .eq("id", item.id)
      )
    );
  }

  console.log(`✓ Successfully updated ${items.length} menu item photos with HD Unsplash images.`);
}

main();
