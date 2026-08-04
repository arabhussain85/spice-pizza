// Time helpers for the counter/admin UI.

/** "7:42 PM" */
export function formatClock(d: Date = new Date()): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Occupied duration from an ISO timestamp: "42 min" or "1h 04m". */
export function formatDuration(fromIso: string | null | undefined, now: Date = new Date()): string {
  if (!fromIso) return "";
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** "Friday, 4 Aug" */
export function formatLongDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

/** Greeting by hour of day. */
export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
