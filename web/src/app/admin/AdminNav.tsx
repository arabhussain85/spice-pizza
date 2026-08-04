"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";

const tabs = [
  { href: "/admin", label: "Today", icon: "◆" },
  { href: "/admin/reports", label: "Reports", icon: "▤" },
  { href: "/admin/menu", label: "Menu", icon: "☰" },
];

const more = [
  { href: "/admin/orders", label: "Order history" },
  { href: "/admin/payments", label: "Payment approvals" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <>
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-hairline bg-surface/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                isActive(t.href) ? "text-brand" : "text-muted",
              )}
            >
              <span className="text-base leading-none">{t.icon}</span>
              {t.label}
            </Link>
          ))}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              more.some((m) => isActive(m.href)) ? "text-brand" : "text-muted",
            )}
          >
            <span className="text-base leading-none">⋯</span>
            More
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-surface p-4 pb-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" />
            <div className="grid gap-1">
              {more.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm font-medium",
                    isActive(m.href) ? "bg-brand-tint text-brand" : "hover:bg-cream",
                  )}
                >
                  {m.label}
                </Link>
              ))}
              <div className="mt-1 border-t border-hairline px-4 pt-3">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
