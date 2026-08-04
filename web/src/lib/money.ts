// PKR money formatting. Mockups use South-Asian lakh grouping, e.g. "Rs. 3,12,400".

const grouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Format a number of rupees as "Rs. 1,234" / "Rs. 3,12,400". */
export function formatRs(amount: number | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  return `Rs. ${grouping.format(n)}`;
}

/** Bare grouped number without the "Rs." prefix (for tight table cells). */
export function formatAmount(amount: number | null | undefined): string {
  return grouping.format(Math.round(Number(amount ?? 0)));
}

/** Compact form for chart axis labels, e.g. 48000 -> "48k". */
export function formatCompact(amount: number | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
