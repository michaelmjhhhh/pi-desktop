import { NextResponse, type NextRequest } from "next/server";
import { isApiRequestAllowed, isApiRequestHostAllowed } from "@/lib/request-security";

// Electron's backend authenticates every request before it reaches Next.js.
// Keep origin checks as defense in depth and for the local development server.
export function proxy(request: NextRequest) {
  const api = request.nextUrl.pathname === "/api" || request.nextUrl.pathname.startsWith("/api/");
  const allowed = api ? isApiRequestAllowed(request) : isApiRequestHostAllowed(request);
  if (!allowed) return NextResponse.json({ error: "Untrusted request" }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: ["/", "/api/:path*"] };
