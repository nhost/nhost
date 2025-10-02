import { useNhostClient } from "@/providers/nhost";
import type { SignInProvider, SignInProviderParams } from "@nhost/nhost-js/auth";

/**
 * Hook to generate an OAuth provider sign-in URL
 * 
 * This is a thin wrapper around the Nhost SDK's signInProviderURL method
 * that provides access to the Nhost client instance via React context.
 * 
 * @param provider - The OAuth provider name (e.g., "github", "google")
 * @param options - Optional parameters for the OAuth flow (redirectTo, connect, etc.)
 *                  Defaults redirectTo to window.location.origin if not specified
 * @returns The complete OAuth provider URL
 * 
 * @example
 * ```tsx
 * // Uses default redirectTo (window.location.origin)
 * const githubUrl = useProviderLink("github");
 * 
 * // Custom redirectTo
 * const githubUrl = useProviderLink("github", {
 *   redirectTo: "/profile"
 * });
 * 
 * <Link to={githubUrl}>Sign in with GitHub</Link>
 * ```
 */
export const useProviderLink = (
  provider: SignInProvider,
  options?: SignInProviderParams,
): string => {
  const nhost = useNhostClient();

  return nhost.auth.signInProviderURL(provider, {
    redirectTo: window.location.origin,
    ...options,
  });
};

