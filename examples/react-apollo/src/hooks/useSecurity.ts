import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/auth";
import { useNhostClient } from "@/providers/nhost";
import { startAuthentication } from "@simplewebauthn/browser";

interface SecurityKey {
  id: string;
  nickname?: string;
}

interface SecurityKeysQuery {
  authUserSecurityKeys: SecurityKey[];
}

interface UseSecurityReturn {
  hasSecurityKeys: boolean;
  securityKeys: SecurityKey[];
  isElevated: boolean;
  isLoading: boolean;
  requiresElevation: boolean;
  checkElevation: () => Promise<void>;
  removeElevation: () => Promise<void>;
  refreshSecurityKeys: () => Promise<void>;
}

/**
 * custom hook for managing security keys and elevation state
 *
 * provides:
 * - security keys data and loading state
 * - current elevation status
 * - helper to check if elevation is required
 * - function to perform elevation check
 */
export function useSecurity(): UseSecurityReturn {
  const { user } = useAuth();
  const nhost = useNhostClient();

  const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isElevated = Boolean(
    nhost.getUserSession()?.decodedToken?.["https://hasura.io/jwt/claims"]?.[
      "x-hasura-auth-elevated"
    ],
  );

  const hasSecurityKeys = securityKeys.length > 0;
  const requiresElevation = !isElevated && hasSecurityKeys;

  const fetchSecurityKeys = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const response = await nhost.graphql.request<SecurityKeysQuery>({
        query: `
          query securityKeys($userId: uuid!) {
            authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
              id
              nickname
            }
          }
        `,
        variables: { userId: user.id },
      });

      if (response.body.data?.authUserSecurityKeys) {
        setSecurityKeys(response.body.data.authUserSecurityKeys);
      }
    } catch (error) {
      console.error("Failed to fetch security keys:", error);
      setSecurityKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, nhost.graphql]);

  const checkElevation = useCallback(async () => {
    if (!requiresElevation) return;

    try {
      // get webauthn challenge from server
      const elevateResponse = await nhost.auth.elevateWebauthn();

      // user authenticates with their security key
      const credential = await startAuthentication(elevateResponse.body);

      // verify the credential and get new elevated session
      const verifyResponse = await nhost.auth.verifyElevateWebauthn({
        email: nhost.getUserSession()?.user?.email,
        credential,
      });

      // update session storage with elevated session
      if (verifyResponse.body.session) {
        nhost.sessionStorage.set(verifyResponse.body.session);
      } else {
        throw new Error("Failed to get elevated session");
      }
    } catch (error) {
      console.error("Elevation error:", error);
      throw new Error("Could not elevate permissions");
    }
  }, [requiresElevation, nhost]);

  const removeElevation = useCallback(async () => {
    if (!isElevated) return;

    try {
      // force token refresh to remove elevated claim
      // Use marginSeconds: 0 to force refresh regardless of token expiration
      const refreshedSession = await nhost.refreshSession(0);
      
      // update session storage with the new non-elevated session
      if (refreshedSession) {
        nhost.sessionStorage.set(refreshedSession);
      }
    } catch (error) {
      console.error("Remove elevation error:", error);
      throw new Error("Could not remove elevated permissions");
    }
  }, [isElevated, nhost]);

  useEffect(() => {
    fetchSecurityKeys();
  }, [fetchSecurityKeys]);

  return {
    hasSecurityKeys,
    securityKeys,
    isElevated,
    isLoading,
    requiresElevation,
    checkElevation,
    removeElevation,
    refreshSecurityKeys: fetchSecurityKeys,
  };
}

/**
 * simpler hook for components that only need elevation checking
 *
 * provides:
 * - current elevation status
 * - whether elevation is required (has keys but not elevated)
 * - function to perform elevation check
 */
export function useElevation() {
  const { isElevated, requiresElevation, checkElevation, removeElevation, hasSecurityKeys } =
    useSecurity();

  return {
    isElevated,
    requiresElevation,
    hasSecurityKeys,
    checkElevation,
    removeElevation,
  };
}
