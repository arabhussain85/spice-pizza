"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { Card, Pill, Button, cn } from "@/components/ui";

interface DiscountActivity {
  id: string;
  order_number: string;
  table_number: number | null;
  type: "percent" | "fixed";
  value: number;
  reason?: string;
  applied_by?: string;
  applied_at: string;
  subtotal: number;
  discount_amount: number;
}

export default function AdminDiscountsPage() {
  const supaRef = useRef(createClient());
  const [serviceChargePct, setServiceChargePct] = useState(5);
  const [discountsRole, setDiscountsRole] = useState<"owner" | "any">("owner");
  const [requireReason, setRequireReason] = useState(true);
  const [activities, setActivities] = useState<DiscountActivity[]>([]);
  const [todayComps, setTodayComps] = useState(0);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supa = supaRef.current;
    // Fetch settings
    const { data: set } = await supa.from("settings").select("*").eq("id", 1).maybeSingle();
    if (set) {
      if (set.default_service_charge_pct != null) setServiceChargePct(set.default_service_charge_pct);
      if (set.discounts_role != null) setDiscountsRole(set.discounts_role);
    }

    // Fetch discount activities from discounts table
    const { data: disc } = await supa
      .from("discounts")
      .select("id, type, value, reason, applied_by, created_at, orders(order_number, restaurant_tables(number))")
      .order("created_at", { ascending: false })
      .limit(20);

    if (disc) {
      const mapped: DiscountActivity[] = disc.map((d: any) => ({
        id: d.id,
        order_number: d.orders?.order_number ?? "—",
        table_number: d.orders?.restaurant_tables?.number ?? null,
        type: d.type,
        value: Number(d.value),
        reason: d.reason,
        applied_by: d.applied_by ?? "Staff",
        applied_at: d.created_at,
        subtotal: 0,
        discount_amount: d.type === "percent" ? 0 : Number(d.value),
      }));
      setActivities(mapped);
      setTodayComps(mapped.reduce((acc, m) => acc + m.discount_amount, 0));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleUpdateSettings() {
    const supa = supaRef.current;
    await supa.from("settings").upsert({
      id: 1,
      default_service_charge_pct: serviceChargePct,
      discounts_role: discountsRole,
    });
    setSavedMsg("Settings saved!");
    setTimeout(() => setSavedMsg(null), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Discount &amp; Fee Settings</h1>
          <p className="text-sm text-[#605e5b]">Manage global pricing rules and review applied discounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="green">System Online</Pill>
        </div>
      </div>

      {savedMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
          {savedMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Settings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Service Charge Card */}
          <Card className="p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#af101a]" />
            <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#af101a]">percent</span>
              Service Charge
            </h2>
            <p className="text-xs text-[#605e5b] mb-4">
              Default service charge rate applied to all dine-in restaurant orders.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#605e5b] mb-1">Percentage Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    value={serviceChargePct}
                    onChange={(e) => setServiceChargePct(Number(e.target.value))}
                    className="w-full h-11 bg-[#fff0ef] border border-[#e4beba] rounded-xl px-4 font-bold text-lg text-[#1A1A1A] outline-none focus:border-[#af101a]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-[#605e5b]">%</span>
                </div>
              </div>
              <Button onClick={handleUpdateSettings} variant="primary" className="h-11 px-5">
                Update
              </Button>
            </div>
          </Card>

          {/* Permissions Card */}
          <Card className="p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#FFA000]" />
            <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#FFA000]">admin_panel_settings</span>
              Permissions
            </h2>
            <p className="text-xs text-[#605e5b] mb-4">
              Control staff autonomy for applying discounts during counter service.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-[#fff0ef] rounded-xl border border-[#e4beba]">
                <div>
                  <h4 className="text-sm font-semibold text-[#1A1A1A]">Require Owner PIN for Discounts</h4>
                  <p className="text-xs text-[#605e5b]">Restricts discount creation to owner account code</p>
                </div>
                <input
                  type="checkbox"
                  checked={discountsRole === "owner"}
                  onChange={(e) => setDiscountsRole(e.target.checked ? "owner" : "any")}
                  className="w-5 h-5 accent-[#af101a] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#fff0ef] rounded-xl border border-[#e4beba]">
                <div>
                  <h4 className="text-sm font-semibold text-[#1A1A1A]">Require Reason Code</h4>
                  <p className="text-xs text-[#605e5b]">Mandatory text reason for all discounts and item voids</p>
                </div>
                <input
                  type="checkbox"
                  checked={requireReason}
                  onChange={(e) => setRequireReason(e.target.checked)}
                  className="w-5 h-5 accent-[#af101a] cursor-pointer"
                />
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 text-center">
              <span className="block text-xs font-semibold text-[#605e5b] uppercase tracking-wider mb-1">
                Recent Comps
              </span>
              <span className="text-2xl font-bold text-[#af101a]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                {formatRs(todayComps)}
              </span>
            </Card>
            <Card className="p-4 text-center">
              <span className="block text-xs font-semibold text-[#605e5b] uppercase tracking-wider mb-1">
                Total Applied
              </span>
              <span className="text-2xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                {activities.length}
              </span>
            </Card>
          </div>
        </div>

        {/* Right Column: Discount History Log */}
        <div className="lg:col-span-7">
          <Card className="p-0 overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-[#e4beba] flex items-center justify-between bg-white">
              <h2 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#605e5b]">history</span>
                Discount Activity Log
              </h2>
              <Pill tone="neutral">{activities.length} records</Pill>
            </div>

            <div className="divide-y divide-[#e4beba] overflow-y-auto max-h-[500px]">
              {activities.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between hover:bg-[#fff0ef]/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1A1A1A]">Order #{a.order_number}</span>
                      {a.table_number && <span className="text-xs text-[#605e5b]">Table {a.table_number}</span>}
                    </div>
                    <div className="text-xs text-[#605e5b] mt-0.5">
                      {a.type === "percent" ? `${a.value}% discount` : `Rs. ${a.value} flat discount`}
                      {a.reason ? ` · "${a.reason}"` : ""}
                    </div>
                    <div className="text-[11px] text-[#605e5b] mt-0.5">
                      Applied by {a.applied_by} at {formatClock(new Date(a.applied_at))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-[#af101a]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                      {a.type === "percent" ? `${a.value}%` : formatRs(a.value)}
                    </span>
                    <div className="mt-1">
                      <Pill tone="green" className="text-[10px]">Applied</Pill>
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="p-8 text-center text-sm text-[#605e5b]">
                  No discount activity recorded yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
