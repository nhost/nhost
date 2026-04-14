import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createNhostClient } from '../../lib/nhost/server';

const PKCE_VERIFIER_KEY = 'nhost_pkce_verifier';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const errorUrl = new URL('/verify/error', request.url);

  if (!code) {
    errorUrl.searchParams.set('message', 'No authorization code found in URL');
    return NextResponse.redirect(errorUrl);
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get(PKCE_VERIFIER_KEY)?.value;

  if (!codeVerifier) {
    errorUrl.searchParams.set(
      'message',
      'No PKCE verifier found. The sign-in must be initiated from the same browser.',
    );
    return NextResponse.redirect(errorUrl);
  }

  // Remove the PKCE verifier cookie
  cookieStore.delete(PKCE_VERIFIER_KEY);

  try {
    const nhost = await createNhostClient();
    await nhost.auth.tokenExchange({ code, codeVerifier });
  } catch (err) {
    errorUrl.searchParams.set(
      'message',
      `Verification failed: ${(err as Error).message}`,
    );
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL('/profile', request.url));
}
