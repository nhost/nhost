import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleNhostMiddleware } from "./app/lib/nhost/server";

// Define public routes that don't require authentication
const publicRoutes = ["/signin", "/signup", "/verify"];

export async function middleware(request: NextRequest) {
  // Create a response that we'll modify as needed
  const response = NextResponse.next();

  // Get the current path
  const path = request.nextUrl.pathname;

  // Check if this is a public route or a public asset
  const isPublicRoute = publicRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  // If it's a public route, allow access without checking auth
  if (isPublicRoute) {
    return response;
  }

  // this is the only Nhost specific code in this middleware
  const session = await handleNhostMiddleware(request, response);

  // If no session and not a public route, redirect to signin
  if (!session) {
    const signInUrl = new URL("/signin", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Session exists, allow access to protected route
  return response;
}

// Define which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
