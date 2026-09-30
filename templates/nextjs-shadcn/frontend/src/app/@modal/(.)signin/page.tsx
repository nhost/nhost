import { SignInModal } from '@/app/@modal/(.)signin/SignInModal';
import { signInDestination } from '@/app/signin/destination';

export const dynamic = 'force-dynamic';

/**
 * `/signin` when you arrive from inside the app.
 *
 * `(.)signin` intercepts the link and renders the route into the modal slot
 * instead of replacing the page. The URL is the real one either way, so the
 * address bar, a refresh and a shared link all still work; a refresh simply
 * drops the interception and renders the full page below.
 */
export default async function InterceptedSignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return <SignInModal next={signInDestination(next)} />;
}
