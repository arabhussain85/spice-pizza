import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RestaurantTable,
  MenuCategory,
  MenuItem,
  MenuProduct,
  Order,
  OrderRound,
  OrderLineItem,
  Discount,
} from "./types";
import { sumLines } from "./order-math";

// ---------------------------------------------------------------------------
// Table grid (counter home)
// ---------------------------------------------------------------------------
export interface TableGridRow {
  table: RestaurantTable;
  order: {
    id: string;
    order_number: string;
    opened_at: string;
    rounds: number;
    runningTotal: number;
  } | null;
}

export async function fetchTableGrid(supa: SupabaseClient): Promise<TableGridRow[]> {
  const [tablesRes, ordersRes] = await Promise.all([
    supa.from("restaurant_tables").select("*").order("number"),
    supa
      .from("orders")
      .select(
        "id,table_id,opened_at,order_number,order_rounds(id,order_line_items(quantity,unit_price,is_voided))",
      )
      .eq("status", "open"),
  ]);
  if (tablesRes.error) throw tablesRes.error;
  if (ordersRes.error) throw ordersRes.error;

  const tables = (tablesRes.data ?? []) as RestaurantTable[];
  const orders = (ordersRes.data ?? []) as Array<{
    id: string;
    table_id: string;
    opened_at: string;
    order_number: string;
    order_rounds: { id: string; order_line_items: OrderLineItem[] }[];
  }>;

  const byTable = new Map(orders.map((o) => [o.table_id, o]));
  return tables.map((table) => {
    const o = byTable.get(table.id);
    if (!o) return { table, order: null };
    const rounds = o.order_rounds ?? [];
    const lines = rounds.flatMap((r) => r.order_line_items ?? []).filter((li) => !li.is_voided);
    // If order has no non-voided items added yet, do NOT deem table occupied in the grid
    if (lines.length === 0) {
      return { table: { ...table, status: "free" }, order: null };
    }
    return {
      table: { ...table, status: "occupied" },
      order: {
        id: o.id,
        order_number: o.order_number,
        opened_at: o.opened_at,
        rounds: rounds.length,
        runningTotal: sumLines(lines),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Menu (grouped into products with size variants)
// ---------------------------------------------------------------------------
export interface MenuCategoryWithProducts {
  category: MenuCategory;
  products: MenuProduct[];
}

export async function fetchMenu(
  supa: SupabaseClient,
  opts: { liveOnly?: boolean } = {},
): Promise<MenuCategoryWithProducts[]> {
  const liveOnly = opts.liveOnly ?? true;
  const catsRes = await supa.from("menu_categories").select("*").order("sort_order");
  if (catsRes.error) throw catsRes.error;

  let itemsQuery = supa.from("menu_items").select("*").is("deleted_at", null).order("sort_order");
  if (liveOnly) itemsQuery = itemsQuery.eq("is_live", true);
  const itemsRes = await itemsQuery;
  if (itemsRes.error) throw itemsRes.error;

  const cats = (catsRes.data ?? []) as MenuCategory[];
  const items = (itemsRes.data ?? []) as MenuItem[];

  const byCat = new Map<string, MenuItem[]>();
  for (const it of items) {
    if (!byCat.has(it.category_id)) byCat.set(it.category_id, []);
    byCat.get(it.category_id)!.push(it);
  }

  return cats.map((category) => {
    const list = byCat.get(category.id) ?? [];
    const groups = new Map<string, MenuItem[]>();
    for (const it of list) {
      const key = it.group_key ?? it.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }
    const products: MenuProduct[] = [...groups.entries()].map(([group_key, variants]) => {
      variants.sort((a, b) => a.price - b.price);
      const first = variants[0];
      return {
        group_key,
        name: first.name,
        category_id: category.id,
        description: first.description,
        photo_url: first.photo_url,
        variants,
      };
    });
    return { category, products };
  });
}

// ---------------------------------------------------------------------------
// Full order (order builder + bill)
// ---------------------------------------------------------------------------
export interface RoundWithItems extends OrderRound {
  order_line_items: OrderLineItem[];
}
export interface OrderFull {
  order: Order;
  table: RestaurantTable | null;
  rounds: RoundWithItems[];
  discount: Discount | null;
}

export async function fetchOrderFull(supa: SupabaseClient, orderId: string): Promise<OrderFull | null> {
  const { data, error } = await supa
    .from("orders")
    .select(
      "*,restaurant_tables(*),order_rounds(*,order_line_items(*)),discounts(*)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const d = data as Order & {
    restaurant_tables: RestaurantTable | null;
    order_rounds: RoundWithItems[];
    discounts: Discount[];
  };
  const rounds = (d.order_rounds ?? []).sort((a, b) => a.round_number - b.round_number);
  for (const r of rounds) {
    r.order_line_items = (r.order_line_items ?? []).sort(
      (a, b) => (a.created_at < b.created_at ? -1 : 1),
    );
  }
  return {
    order: data as Order,
    table: d.restaurant_tables ?? null,
    rounds,
    discount: d.discounts?.[0] ?? null,
  };
}
