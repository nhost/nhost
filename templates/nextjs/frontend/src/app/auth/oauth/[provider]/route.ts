import { type NextRequest, NextResponse } from 'next/server';
import { signInDestination } from '@/app/signin/destination';
import { recordSignInAttempt } from '@/app/signin/lastUsed';
import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient } from '@/lib/nhost/server';
import {
  ACCOUNT_PICKER,
  configuredProviders,
  providerHref,
} from '../providers';

/** Where a provider button goes before the provider. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;
  const found = configuredProviders().find(({ id }) => id === provider);
  if (!found) {
    return new NextResponse(null, { status: 404 });
  }

  const destination = signInDestination(
    request.nextUrl.searchParams.get('next') ?? undefined,
  );
  const nhost = await createNhostClient();
  const url = nhost.auth.signInProviderURL(found.id, {
    redirectTo: appOrigin() + destination,
    upstreamParams: ACCOUNT_PICKER,
  });

  return recordSignInAttempt(
    NextResponse.redirect(url),
    providerHref(found.id),
  );
}
