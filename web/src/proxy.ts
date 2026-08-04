import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// Route protection (Next 16 "Proxy" = former Middleware).
// Gated by NEXT_PUBLIC_AUTH_ENABLED so it can be turned off if login misbehaves.
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== "true") return response;

  const { pathname } = request.nextUrl;
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/login") url.searchParams.set("next", pathname);
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c.name, c.value));
    return r;
  };

  if (!user && pathname !== "/login") return redirectTo("/login");
  if (user && pathname === "/login") return redirectTo(role === "counter_staff" ? "/counter" : "/admin");
  if (user && pathname.startsWith("/admin") && role !== "owner") return redirectTo("/counter");

  return response;
}

export const config = {
  // run on everything except Next internals and static image assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
