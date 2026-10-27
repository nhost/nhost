import { type NextRequest, NextResponse } from 'next/server';
import {
  ACCOUNT_PICKER,
  configuredProviders,
} from '@/app/auth/oauth/providers';
import { signInHref } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient } from '@/lib/nhost/server';

const ACCOUNT_PATH = '/account';

/**
 * Where a Link account button goes: the same provider round trip as signing in,
 * with the session's access token as `connect`, which tells the auth service to
 * add the provider to that account rather than sign anyone in.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;
  const found = configuredProviders().find(({ id }) => id === provider);
  if (!found) {
    return new NextResponse(null, { status: 404 });
  }

  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(signInHref(ACCOUNT_PATH), request.url),
    );
  }

  return NextResponse.redirect(
    nhost.auth.signInProviderURL(found.id, {
      connect: session.accessToken,
      redirectTo: appOrigin() + ACCOUNT_PATH,
      upstreamParams: ACCOUNT_PICKER,
    }),
  );
}
