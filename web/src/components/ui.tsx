import type { ButtonHTMLAttributes, ReactNode } from "react";

/** minimal className joiner */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Brand "S" logo mark. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-xl bg-brand font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      S
    </div>
  );
}

type Variant = "primary" | "soft" | "soft-green" | "ghost" | "outline";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-sm",
  soft: "bg-brand-tint text-brand hover:bg-brand-tint-2",
  "soft-green": "bg-free-tint text-free-dark hover:brightness-95",
  ghost: "text-brand hover:bg-brand-tint/60",
  outline: "border border-hairline bg-surface text-ink hover:border-brand/40",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "amber";
  className?: string;
}) {
  const tones = {
    neutral: "bg-black/5 text-muted",
    green: "bg-free-tint text-free-dark",
    red: "bg-brand-tint text-brand",
    amber: "bg-amber-100 text-amber-700",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-hairline bg-surface shadow-sm", className)}>
      {children}
    </div>
  );
}

/** Circular staff avatar with initials. */
export function Avatar({ name }: { name?: string | null }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
      {initials || "·"}
    </div>
  );
}
