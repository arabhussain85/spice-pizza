import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  // Destructive dev-only tool — never allow it to run on a production deploy.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supa = createClient(supabaseUrl, serviceRoleKey);

    // 1. Delete all payments
    await supa.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Delete all discounts on orders
    await supa.from("discounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Delete order line items, rounds, and orders
    await supa.from("order_line_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supa.from("order_rounds").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supa.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 4. Reset table statuses to free
    await supa.from("restaurant_tables").update({ status: "free" }).neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({ success: true, message: "Demo data reset clean!" });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
