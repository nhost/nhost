import { DEFAULT_INTENT } from '@/app/signin/intent';
import { signInQuery } from '@/app/signin/query';
import OAuthButtons from './OAuthButtons';
import { configuredProviders, providerHref } from './providers';

/**
 * A button for each provider the deployment set up, shown on the sign-in list
 * itself.
 */
export default function ProviderSignIn({
  destination,
  lastUsed,
}: {
  destination: string;
  lastUsed: string | null;
}) {
  const links = configuredProviders().map(({ id, label }) => ({
    id,
    label,
    href: `${providerHref(id)}${signInQuery(destination, DEFAULT_INTENT)}`,
    lastUsed: providerHref(id) === lastUsed,
  }));

  return <OAuthButtons links={links} />;
}
