"use server";

import { createAdminClient } from "@/lib/supabase/admin";

interface ReceiptConfigInput {
  brand_name: string;
  receipt_tagline: string;
  receipt_address: string;
  receipt_phone: string;
  receipt_ntn: string;
  receipt_footer: string;
  receipt_wifi_ssid: string;
  receipt_wifi_pass: string;
  receipt_show_wifi: boolean;
  receipt_show_service: boolean;
  receipt_show_notes: boolean;
}

export async function saveReceiptConfig(input: ReceiptConfigInput) {
  const supa = createAdminClient();
  const { error } = await supa.from("settings").update(input).eq("id", 1);
  if (error) throw new Error(error.message);
  return { ok: true };
}
