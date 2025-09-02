import type { ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createNhostClient } from "../lib/nhost/server";

export async function GET(request: NextRequest) {
  const refreshToken = request.nextUrl.searchParams.get("refreshToken");

  if (!refreshToken) {
    // Collect all query parameters
    const params = new URLSearchParams(request.nextUrl.searchParams);
    params.set("message", "No refresh token provided");

    return NextResponse.redirect(
      new URL(`/verify/error?${params.toString()}`, request.url),
    );
  }

  try {
    const nhost = await createNhostClient();

    if (nhost.getUserSession()) {
      // Collect all query parameters
      const params = new URLSearchParams(request.nextUrl.searchParams);
      params.set("message", "Already signed in");

      return NextResponse.redirect(
        new URL(`/verify/error?${params.toString()}`, request.url),
      );
    }

    await nhost.auth.refreshToken({ refreshToken });

    return NextResponse.redirect(new URL("/profile", request.url));
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    const errorMessage = `Failed to verify token: ${error.message}`;

    // Collect all query parameters
    const params = new URLSearchParams(request.nextUrl.searchParams);
    params.set("message", errorMessage);

    return NextResponse.redirect(
      new URL(`/verify/error?${params.toString()}`, request.url),
    );
  }
}
