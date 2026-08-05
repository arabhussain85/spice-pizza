"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn, Logo, Pill } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";

const tabs = [
  { href: "/admin", label: "Today", icon: "📊" },
  { href: "/admin/reports", label: "Reports", icon: "📈" },
  { href: "/admin/menu", label: "Menu", icon: "🍕" },
];

const more = [
  { href: "/admin/orders", label: "Order History", icon: "📋" },
  { href: "/admin/payments", label: "Payment Approvals", icon: "💳" },
  { href: "/admin/settings/receipt", label: "Receipt Customizer", icon: "🧾" },
  { href: "/admin/settings/printer", label: "Printer Section", icon: "🖨️" },
  { href: "/admin/staff", label: "Staff Management", icon: "👥" },
  { href: "/admin/settings", label: "General Settings", icon: "⚙️" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <>
      {/* Top Header for Desktop & Mobile */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <Logo size={34} />
              <div>
                <span className="font-black tracking-tight text-ink text-base group-hover:text-brand transition-colors">
                  Spice Pizza
                </span>
                <span className="ml-2 rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-extrabold text-brand uppercase tracking-wider">
                  Admin
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/counter"
              className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-cream/50 px-3 py-1.5 text-xs font-bold text-ink hover:border-brand/40 hover:bg-surface transition-all shadow-2xs"
            >
              <span>🖥️ Counter View</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {tabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                    isActive(t.href)
                      ? "bg-brand-tint text-brand font-bold"
                      : "text-ink-muted hover:text-ink hover:bg-cream/60"
                  )}
                >
                  {t.label}
                </Link>
              ))}
              <div className="h-4 w-px bg-hairline mx-1" />
              <Link
                href="/admin/settings/receipt"
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1",
                  isActive("/admin/settings/receipt")
                    ? "bg-brand-tint text-brand font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-cream/60"
                )}
              >
                <span>🧾 Receipt</span>
              </Link>
              <Link
                href="/admin/settings/printer"
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1",
                  isActive("/admin/settings/printer")
                    ? "bg-brand-tint text-brand font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-cream/60"
                )}
              >
                <span>🖨️ Printer</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-hairline bg-surface/95 backdrop-blur-md shadow-lg md:hidden">
        <div className="grid grid-cols-4">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-all",
                isActive(t.href) ? "text-brand font-bold" : "text-ink-muted hover:text-ink"
              )}
            >
              <span className="text-base leading-none">{t.icon}</span>
              {t.label}
            </Link>
          ))}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-all cursor-pointer",
              more.some((m) => isActive(m.href)) ? "text-brand font-bold" : "text-ink-muted hover:text-ink"
            )}
          >
            <span className="text-base leading-none">⚙️</span>
            More
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 pb-8 shadow-2xl border-t border-hairline animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-hairline" />
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted px-2">Navigation & Tools</h3>
            <div className="grid gap-1.5">
              {more.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                    isActive(m.href) ? "bg-brand-tint text-brand font-bold" : "hover:bg-cream text-ink"
                  )}
                >
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </Link>
              ))}
              <div className="mt-3 border-t border-hairline px-2 pt-4">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
