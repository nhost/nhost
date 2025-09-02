import { Suspense } from "react";
import SecurityKeyClient from "../components/SecurityKeyClient";
import { createNhostClient } from "../lib/nhost/server";

/**
 * Represents a WebAuthn security key stored for a user
 */
interface SecurityKey {
  id: string;
  credentialId: string;
  nickname: string | null;
}

/**
 * GraphQL response format for security keys query
 */
interface SecurityKeysData {
  authUserSecurityKeys: SecurityKey[];
}

export default async function SecurityKeys() {
  // Initialize the server-side Nhost client
  const nhost = await createNhostClient();

  // Get the current session
  const session = nhost.getUserSession();

  // Default values for when not authenticated or when data can't be fetched
  let securityKeys: SecurityKey[] = [];
  let isLoading = false;
  let error: string | null = null;

  if (session) {
    isLoading = true;

    try {
      // Server-side fetch of security keys
      const response = await nhost.graphql.request<SecurityKeysData>({
        query: `
          query GetUserSecurityKeys {
            authUserSecurityKeys {
              id
              credentialId
              nickname
            }
          }
        `,
      });

      // Extract security keys from the response
      if (response.body.data?.authUserSecurityKeys) {
        securityKeys = response.body.data.authUserSecurityKeys;
      }
      isLoading = false;
    } catch (err: unknown) {
      error = `Failed to fetch security keys: ${err instanceof Error ? err.message : String(err)}`;
      console.error(error);
      isLoading = false;
    }
  }

  // If still loading or not authenticated, show appropriate message
  if (!session) {
    return (
      <div className="glass-card p-8 mb-6">
        <h3 className="text-xl mb-4">Security Keys</h3>
        <p>You must be signed in to manage your security keys.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-card p-8 mb-6">
        <h3 className="text-xl mb-4">Security Keys</h3>
        <p>Loading security keys...</p>
      </div>
    );
  }

  // Render the client component with the server-fetched data
  // Wrap in Suspense to handle any potential async rendering issues
  return (
    <Suspense
      fallback={
        <div className="glass-card p-8 mb-6">
          <h3 className="text-xl mb-4">Security Keys</h3>
          <p>Loading security keys...</p>
        </div>
      }
    >
      <SecurityKeyClient
        initialSecurityKeys={securityKeys}
        serverError={error}
      />
    </Suspense>
  );
}
