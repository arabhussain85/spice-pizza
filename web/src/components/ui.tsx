import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** Minimal className joiner */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Brand "S" logo mark with warm gradient & glow. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark font-black text-white shadow-md shadow-brand/20 transition-transform hover:scale-105",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(14, size * 0.45) }}
    >
      P
    </div>
  );
}

type Variant = "primary" | "soft" | "soft-green" | "ghost" | "outline" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-brand to-brand-dark text-white hover:opacity-95 shadow-sm shadow-brand/20 active:scale-[0.98]",
  soft: "bg-brand-tint text-brand hover:bg-brand-tint-2 active:scale-[0.98]",
  "soft-green": "bg-free-tint text-free-dark hover:brightness-95 active:scale-[0.98]",
  ghost: "text-ink-muted hover:text-brand hover:bg-brand-tint/60 active:scale-[0.98]",
  outline: "border border-hairline bg-surface text-ink hover:border-brand/40 hover:bg-cream/30 active:scale-[0.98]",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-500/20 active:scale-[0.98]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  loading = false,
  ...rest
}: {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs font-semibold rounded-lg",
    md: "px-4 py-2.5 text-sm font-semibold rounded-xl",
    lg: "px-5 py-3 text-base font-semibold rounded-xl",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "blue" | "purple";
  className?: string;
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700 border border-gray-200/60",
    green: "bg-free-tint text-free-dark border border-green-200/60",
    red: "bg-brand-tint text-brand border border-red-200/60",
    amber: "bg-amber-50 text-amber-800 border border-amber-200/60",
    blue: "bg-blue-50 text-blue-700 border border-blue-200/60",
    purple: "bg-purple-50 text-purple-700 border border-purple-200/60",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight shadow-2xs",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-surface shadow-xs transition-all duration-200",
        hover && "hover:shadow-md hover:border-brand/30 hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Circular staff avatar with initials. */
export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="grid place-items-center rounded-full bg-gradient-to-tr from-brand to-brand-dark font-bold text-white shadow-xs"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials || "·"}
    </div>
  );
}

/** Input wrapper component */
export function InputField({
  label,
  error,
  helperText,
  className,
  inputClassName,
  ...props
}: {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
  inputClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</label>}
      <input
        className={cn(
          "w-full rounded-xl border border-hairline bg-cream/30 px-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-muted focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/10",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/10",
          inputClassName
        )}
        {...props}
      />
      {error ? (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-muted">{helperText}</p>
      ) : null}
    </div>
  );
}

/** Toggle switch component */
export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      {(label || description) && (
        <div>
          {label && <div className="text-sm font-medium text-ink">{label}</div>}
          {description && <div className="text-xs text-muted">{description}</div>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand/20",
          checked ? "bg-brand" : "bg-gray-200"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}

/** Tab navigation bar */
export function TabNav<T extends string>({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; icon?: ReactNode }[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-xl bg-cream/70 p-1 border border-hairline", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer",
              isActive
                ? "bg-surface text-brand shadow-xs font-bold"
                : "text-ink-muted hover:text-ink hover:bg-white/40"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Modal dialog container */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl border border-hairline max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150",
          className
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3">
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted hover:bg-cream hover:text-ink transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Stat display card */
export function StatCard({
  title,
  value,
  subtext,
  icon,
  trend,
  className,
}: {
  title: string;
  value: ReactNode;
  subtext?: string;
  icon?: ReactNode;
  trend?: { label: string; positive?: boolean };
  className?: string;
}) {
  return (
    <Card className={cn("p-5 border-hairline bg-surface relative overflow-hidden", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
          <h4 className="mt-2 text-2xl font-black tracking-tight text-ink">{value}</h4>
          {subtext && <p className="mt-1 text-xs text-ink-muted">{subtext}</p>}
          {trend && (
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold">
              <span className={trend.positive ? "text-green-600" : "text-brand"}>
                {trend.positive ? "↑" : "↓"} {trend.label}
              </span>
            </div>
          )}
        </div>
        {icon && <div className="rounded-xl bg-brand-tint p-3 text-brand text-xl">{icon}</div>}
      </div>
    </Card>
  );
}
