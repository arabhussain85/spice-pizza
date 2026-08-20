import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMenu, type MenuCategoryWithProducts } from "./queries";

// The counter menu changes rarely, so cache it in-memory (per SPA session) and in
// sessionStorage (survives reloads). This makes the order builder show the menu
// instantly instead of waiting on a round-trip to the (possibly far) database.

const KEY = "spice_menu_v1";
let cache: MenuCategoryWithProducts[] | null = null;
let inflight: Promise<MenuCategoryWithProducts[]> | null = null;

/** Synchronously return the cached menu (memory → sessionStorage), or null. */
export function cachedMenu(): MenuCategoryWithProducts[] | null {
  if (cache) return cache;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as MenuCategoryWithProducts[];
      return cache;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Fetch the menu (de-duped), refreshing the caches. */
export async function loadMenu(supa: SupabaseClient): Promise<MenuCategoryWithProducts[]> {
  if (inflight) return inflight;
  inflight = fetchMenu(supa, { liveOnly: true })
    .then((m) => {
      cache = m;
      try {
        sessionStorage.setItem(KEY, JSON.stringify(m));
      } catch {
        /* quota / unavailable — fine */
      }
      inflight = null;
      return m;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}
