import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  });

  // Protect /api/dashboard/* routes - return 401 if no session
  if (pathname.startsWith("/api/dashboard")) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protect /dashboard/* routes - redirect to sign in if no session
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const base = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://photoportugal.com";
      const signInUrl = new URL("/auth/signin", base);
      signInUrl.searchParams.set("callbackUrl", `${base}${pathname}`);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
