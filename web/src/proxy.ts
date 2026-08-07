import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";
import { verifyCounterToken } from "@/lib/counter-session";

/**
 * Dual-portal route protection.
 *
 * ADMIN PORTAL  (/admin/*)
 *   - Always enforced regardless of env flags
 *   - Uses Supabase session + owner role check
 *   - Unauthed → /login/admin
 *
 * COUNTER PORTAL  (/counter/*)
 *   - Uses a simple PIN cookie (counter_pin=valid)
 *   - PIN is validated client-side and cookie is set by /login/counter
 *   - No Supabase involved — staff never touch admin credentials
 *   - Unauthed → /login/counter
 *
 * There is NO cross-navigation between portals.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Public login routes — always accessible ──────────────────────────────
  if (
    pathname === "/login" ||
    pathname === "/login/admin" ||
    pathname === "/login/counter"
  ) {
    return NextResponse.next();
  }

  // ── Cron endpoints self-protect via CRON_SECRET header — leave untouched ──
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  };

  const isOwner = async () => {
    const { user } = await updateSession(request);
    return (user?.app_metadata as { role?: string } | undefined)?.role === "owner";
  };
  const counterOk = await verifyCounterToken(request.cookies.get("counter_pin")?.value);

  // ── ADMIN PORTAL: Supabase session + owner role ───────────────────────────
  if (pathname.startsWith("/admin")) {
    const { response, user } = await updateSession(request);
    if (!user) return redirectTo("/login/admin");
    const role = (user?.app_metadata as { role?: string } | undefined)?.role;
    if (role !== "owner") return redirectTo("/login/admin");
    return response;
  }

  // ── COUNTER PORTAL: signed PIN-session cookie ────────────────────────────
  if (pathname.startsWith("/counter")) {
    if (!counterOk) return redirectTo("/login/counter");
    return NextResponse.next();
  }

  // ── API: allow a valid counter session OR an owner; otherwise 401 ────────
  if (pathname.startsWith("/api")) {
    if (counterOk || (await isOwner())) return NextResponse.next();
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ── Root / → login selector (default entry point) ────────────────────────
  if (pathname === "/") {
    return redirectTo("/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
