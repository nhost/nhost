import { useEffect, useState } from "react";
import type { JSX } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";
import MFASettings from "../components/MFASettings";
import ChangePassword from "../components/ChangePassword";
import SecurityKeys from "../components/SecurityKeys";
import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError, FetchResponse } from "@nhost/nhost-js/fetch";

interface MfaStatusResponse {
  data?: {
    user?: {
      activeMfaType: string | null;
    };
  };
}

export default function Profile(): JSX.Element {
  const { nhost, user, session, isAuthenticated } = useAuth();
  const [isMfaEnabled, setIsMfaEnabled] = useState<boolean>(false);

  // Fetch MFA status when user is authenticated
  useEffect(() => {
    const fetchMfaStatus = async (): Promise<void> => {
      if (!user?.id) return;

      try {
        // Correctly structure GraphQL query with parameters
        const response: FetchResponse<MfaStatusResponse> =
          await nhost.graphql.request({
            query: `
            query GetUserMfaStatus($userId: uuid!) {
              user(id: $userId) {
                activeMfaType
              }
            }
          `,
            variables: {
              userId: user.id,
            },
          });

        const userData = response.body?.data;
        const activeMfaType = userData?.user?.activeMfaType;
        const newMfaEnabled = activeMfaType === "totp";

        // Update the state
        setIsMfaEnabled(newMfaEnabled);
      } catch (err) {
        const error = err as FetchError<ErrorResponse>;
        console.error(`Failed to query MFA status: ${error.message}`);
      }
    };

    if (isAuthenticated && user?.id) {
      fetchMfaStatus();
    }
  }, [user, isAuthenticated, nhost.graphql]);

  // ProtectedRoute component now handles authentication check
  // We can just focus on the component logic here

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl mb-6 gradient-text">Your Profile</h1>

      <div className="glass-card p-8 mb-6">
        <div className="space-y-5">
          <div className="profile-item">
            <strong>Display Name:</strong>
            <span className="ml-2">{user?.displayName || "Not set"}</span>
          </div>

          <div className="profile-item">
            <strong>Email:</strong>
            <span className="ml-2">{user?.email || "Not available"}</span>
          </div>

          <div className="profile-item">
            <strong>User ID:</strong>
            <span
              className="ml-2"
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: "0.875rem",
              }}
            >
              {user?.id || "Not available"}
            </span>
          </div>

          <div className="profile-item">
            <strong>Roles:</strong>
            <span className="ml-2">{user?.roles?.join(", ") || "None"}</span>
          </div>

          <div className="profile-item">
            <strong>Email Verified:</strong>
            <span className="ml-2">{user?.emailVerified ? "Yes" : "No"}</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-8 mb-6">
        <h3 className="text-xl mb-4">Session Information</h3>
        <pre>{JSON.stringify(session, null, 2)}</pre>
      </div>

      <MFASettings
        key={`mfa-settings-${isMfaEnabled}`}
        initialMfaEnabled={isMfaEnabled}
      />

      <SecurityKeys />

      <ChangePassword />
    </div>
  );
}
