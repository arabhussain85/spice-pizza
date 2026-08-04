"use client";

import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { cn } from "./ui";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => signOut())}
      disabled={pending}
      className={cn("text-sm font-medium text-muted hover:text-brand", className)}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
