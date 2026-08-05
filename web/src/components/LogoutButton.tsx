"use client";

import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { cn } from "./ui";

export function LogoutButton({
  className,
  portal = "counter",
  children,
}: {
  className?: string;
  portal?: "admin" | "counter";
  children?: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => signOut(portal))}
      disabled={pending}
      className={cn(
        "flex items-center gap-2 rounded-xl text-sm font-semibold px-3 py-2 transition-colors hover:bg-[#ffe9e7] hover:text-[#af101a]",
        className
      )}
      style={{ color: pending ? "#8f6f6c" : undefined }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
        logout
      </span>
      {children ?? (pending ? "Signing out…" : "Sign out")}
    </button>
  );
}
