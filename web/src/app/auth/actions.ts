"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut(portal: "admin" | "counter" = "admin") {
  const supa = await createClient();
  await supa.auth.signOut();
  redirect(portal === "admin" ? "/login/admin" : "/login/counter");
}
