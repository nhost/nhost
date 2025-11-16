import { authExchange } from "@urql/exchange-auth";
import type { ReactNode } from "react";
import {
  type Client,
  cacheExchange,
  createClient,
  fetchExchange,
  Provider,
} from "urql";
import { useAuth } from "../nhost/AuthProvider";

interface UrqlProviderProps {
  children: ReactNode;
}

/**
 * UrqlProvider component that provides the urql client to the React application.
 *
 * This component handles:
 * - Creating the urql client with authentication support
 * - Managing GraphQL requests with proper authentication headers
 * - Token refresh handling through Nhost
 */
export const UrqlProvider = ({ children }: UrqlProviderProps) => {
  const { nhost } = useAuth();

  const client: Client = createClient({
    url:
      import.meta.env["VITE_NHOST_GRAPHQL_URL"] ||
      "https://local.graphql.local.nhost.run/v1",
    // Force POST requests (Hasura interprets GET requests as persisted queries)
    preferGetMethod: false,
    exchanges: [
      cacheExchange,
      authExchange(async (utils) => {
        return {
          addAuthToOperation(operation) {
            const session = nhost.getUserSession();
            if (!session?.accessToken) {
              return operation;
            }

            return utils.appendHeaders(operation, {
              Authorization: `Bearer ${session.accessToken}`,
            });
          },
          didAuthError(error) {
            return error.graphQLErrors.some((e) =>
              e.message.includes("JWTExpired"),
            );
          },
          async refreshAuth() {
            const currentSession = nhost.getUserSession();
            if (!currentSession?.refreshToken) {
              return;
            }

            try {
              await nhost.refreshSession(60);
            } catch (e: unknown) {
              console.error(
                "Error refreshing session:",
                e instanceof Error ? e : "Unknown error",
              );
              await nhost.auth.signOut({
                refreshToken: currentSession.refreshToken,
              });
            }
          },
        };
      }),
      fetchExchange,
    ],
  });

  return <Provider value={client}>{children}</Provider>;
};
