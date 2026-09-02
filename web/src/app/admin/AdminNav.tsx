"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn, Logo } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { LogoutButton } from "@/components/LogoutButton";

const tabs = [
  { href: "/admin", label: "Today", icon: "dashboard" },
  { href: "/admin/reports", label: "Reports", icon: "analytics" },
  { href: "/admin/menu", label: "Menu", icon: "restaurant_menu" },
];

const more = [
  { href: "/admin/orders", label: "Order History", icon: "receipt_long" },
  { href: "/admin/expenses", label: "Expenses", icon: "account_balance" },
  { href: "/admin/udhaar", label: "Udhaar (Credit)", icon: "account_balance_wallet" },
  { href: "/admin/discounts", label: "Discounts & Fees", icon: "local_offer" },
  { href: "/admin/payments", label: "Payment Approvals", icon: "payments" },
  { href: "/admin/settings/receipt", label: "Receipt Customizer", icon: "receipt" },
  { href: "/admin/settings/printer", label: "Printer Section", icon: "print" },
  { href: "/admin/staff", label: "Staff Management", icon: "group" },
  { href: "/admin/settings", label: "General Settings", icon: "settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <>
      {/* Top Header for Desktop & Mobile */}
      <header className="sticky top-0 z-30 border-b border-[#e4beba] bg-[#fff8f7]/90 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <Logo size={36} />
              <div>
                <span className="font-black tracking-tight text-[#af101a] text-lg group-hover:text-[#8b0d14] transition-colors">
                  Pizza Bites Admin
                </span>
                <span className="ml-2 rounded-full bg-[#ffe9e7] px-2 py-0.5 text-[10px] font-bold text-[#af101a] uppercase tracking-wider border border-[#e4beba]">
                  Main Branch
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">

            <div className="hidden md:flex items-center gap-1">
              {tabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                    isActive(t.href)
                      ? "bg-[#af101a] text-white shadow-xs"
                      : "text-[#605e5b] hover:text-[#1A1A1A] hover:bg-[#ffe9e7]"
                  )}
                >
                  <Icon name={t.icon} className="text-base" />
                  {t.label}
                </Link>
              ))}
              <div className="h-4 w-px bg-[#e4beba] mx-1" />
              <Link
                href="/admin/discounts"
                className={cn(
                  "flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                  isActive("/admin/discounts")
                    ? "bg-[#af101a] text-white font-bold"
                    : "text-[#605e5b] hover:text-[#1A1A1A] hover:bg-[#ffe9e7]"
                )}
              >
                <Icon name="local_offer" className="text-base" />
                <span>Discounts</span>
              </Link>
              <Link
                href="/admin/settings/receipt"
                className={cn(
                  "flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                  isActive("/admin/settings/receipt")
                    ? "bg-[#af101a] text-white font-bold"
                    : "text-[#605e5b] hover:text-[#1A1A1A] hover:bg-[#ffe9e7]"
                )}
              >
                <Icon name="receipt" className="text-base" />
                <span>Receipt</span>
              </Link>
              <Link
                href="/admin/settings/printer"
                className={cn(
                  "flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                  isActive("/admin/settings/printer")
                    ? "bg-[#af101a] text-white font-bold"
                    : "text-[#605e5b] hover:text-[#1A1A1A] hover:bg-[#ffe9e7]"
                )}
              >
                <Icon name="print" className="text-base" />
                <span>Printer</span>
              </Link>
              <Link
                href="/admin/udhaar"
                className={cn(
                  "flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                  isActive("/admin/udhaar") ? "bg-[#af101a] text-white font-bold" : "text-[#605e5b] hover:text-[#1A1A1A] hover:bg-[#ffe9e7]"
                )}
              >
                <Icon name="account_balance_wallet" className="text-base" />
                <span>Udhaar</span>
              </Link>
              <Link
                href="/admin/expenses"
                className={cn(
                  "flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                  isActive("/admin/expenses") ? "bg-[#af101a] text-white font-bold" : "text-[#605e5b] hover:text-[#1A1A1A] hover:bg-[#ffe9e7]"
                )}
              >
                <Icon name="account_balance" className="text-base" />
                <span>Expenses</span>
              </Link>
              <Link
                href="/admin/settings"
                className={cn(
                  "flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                  pathname === "/admin/settings" || pathname === "/admin/dev"
                    ? "bg-[#af101a] text-white font-bold"
                    : "text-[#605e5b] hover:text-[#1A1A1A] hover:bg-[#ffe9e7]"
                )}
              >
                <Icon name="settings" className="text-base" />
                <span>Settings</span>
              </Link>
            </div>

            {/* Desktop: logout button in header */}
            <div className="hidden md:flex items-center">
              <LogoutButton portal="admin" className="text-xs" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e4beba] bg-white/95 backdrop-blur-md shadow-lg md:hidden">
        <div className="grid grid-cols-4 px-2 py-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-bold transition-all rounded-xl",
                isActive(t.href) ? "bg-[#ffe9e7] text-[#af101a]" : "text-[#605e5b] hover:text-[#1A1A1A]"
              )}
            >
              <Icon name={t.icon} className="text-xl" fill={isActive(t.href)} />
              {t.label}
            </Link>
          ))}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-bold transition-all rounded-xl cursor-pointer",
              more.some((m) => isActive(m.href)) ? "bg-[#ffe9e7] text-[#af101a]" : "text-[#605e5b] hover:text-[#1A1A1A]"
            )}
          >
            <Icon name="more_horiz" className="text-xl" />
            More
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-[#FCF9F5] p-5 pb-8 shadow-2xl border-t border-[#e4beba]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#e4beba]" />
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[#605e5b] px-2">Navigation &amp; Tools</h3>
            <div className="grid gap-1.5">
              {more.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                    isActive(m.href) ? "bg-[#af101a] text-white font-bold" : "hover:bg-[#ffe9e7] text-[#271816]"
                  )}
                >
                  <Icon name={m.icon} className="text-xl" />
                  {m.label}
                </Link>
              ))}
              <div className="mt-3 border-t border-[#e4beba] px-2 pt-4">
                <LogoutButton portal="admin" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
