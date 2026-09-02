import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReceiptConfig {
  brand: string;
  tagline: string;
  address: string;
  phone: string;
  ntn: string;
  footer: string;
  wifiSsid: string;
  wifiPass: string;
  showWifi: boolean;
  showService: boolean;
  showItemNotes: boolean;
}

export const RECEIPT_DEFAULTS: ReceiptConfig = {
  brand: "Pizza Bites",
  tagline: "Authentic Wood-Fired & Special Pizzas",
  address: "Shop #4, Food Street, Main Boulevard, Lahore",
  phone: "+92 300 1234567",
  ntn: "NTN: 7654321-9",
  footer: "Thank you for dining with us! Please visit again.",
  wifiSsid: "PizzaBites_Guest",
  wifiPass: "pizza123",
  showWifi: true,
  showService: true,
  showItemNotes: true,
};

/** Receipt customization from the settings singleton (edited in Admin → Settings → Receipt). */
export async function fetchReceiptConfig(supa: SupabaseClient): Promise<ReceiptConfig> {
  const { data } = await supa.from("settings").select("*").eq("id", 1).maybeSingle();
  const s = (data ?? {}) as Record<string, unknown>;
  const str = (k: string, d: string) => (typeof s[k] === "string" && s[k] ? (s[k] as string) : d);
  const bool = (k: string, d: boolean) => (typeof s[k] === "boolean" ? (s[k] as boolean) : d);
  return {
    brand: str("brand_name", RECEIPT_DEFAULTS.brand),
    tagline: str("receipt_tagline", RECEIPT_DEFAULTS.tagline),
    address: str("receipt_address", RECEIPT_DEFAULTS.address),
    phone: str("receipt_phone", RECEIPT_DEFAULTS.phone),
    ntn: str("receipt_ntn", RECEIPT_DEFAULTS.ntn),
    footer: str("receipt_footer", RECEIPT_DEFAULTS.footer),
    wifiSsid: str("receipt_wifi_ssid", RECEIPT_DEFAULTS.wifiSsid),
    wifiPass: str("receipt_wifi_pass", RECEIPT_DEFAULTS.wifiPass),
    showWifi: bool("receipt_show_wifi", RECEIPT_DEFAULTS.showWifi),
    showService: bool("receipt_show_service", RECEIPT_DEFAULTS.showService),
    showItemNotes: bool("receipt_show_notes", RECEIPT_DEFAULTS.showItemNotes),
  };
}
