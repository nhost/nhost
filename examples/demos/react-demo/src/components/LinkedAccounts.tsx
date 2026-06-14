import type { JSX } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';

/**
 * LinkedAccounts lets an already–authenticated user link an additional OAuth
 * provider to their existing account (the provider "connect" flow).
 *
 * Unlike social sign-in, this passes the current access token as the `connect`
 * parameter so Auth links the provider identity onto the logged-in user instead
 * of creating/looking up a separate account. No PKCE code is exchanged on
 * return — Auth redirects straight back to `redirectTo` with `?state=` (success)
 * or `?error=...&errorDescription=...` (failure), which `ConnectCallback`
 * renders.
 *
 * When the server is configured with `AUTH_REQUIRE_ELEVATED_CLAIM`, linking
 * requires an elevated session, mirroring the other sensitive endpoints.
 */
export default function LinkedAccounts(): JSX.Element {
  const { nhost, session } = useAuth();

  const handleLink = (provider: 'github'): void => {
    const accessToken = session?.accessToken;
    if (!accessToken) return;

    const origin = window.location.origin;

    const url = nhost.auth.signInProviderURL(provider, {
      // Marks this as a link of the current account rather than a new sign-in.
      connect: accessToken,
      redirectTo: `${origin}/connect/callback`,
      // Echoed back as `?state=` so the callback page can name the provider.
      state: provider,
    });

    window.location.href = url;
  };

  return (
    <div className="glass-card p-8 mb-6">
      <h3 className="text-xl mb-4">Connected Accounts</h3>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Link an additional OAuth provider to your existing account. If the
        server requires elevated permissions, you'll need an elevated session to
        link.
      </p>

      <button
        type="button"
        onClick={() => handleLink('github')}
        className="btn btn-secondary w-full flex items-center justify-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
          aria-label="GitHub logo"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        Link GitHub
      </button>
    </div>
  );
}
