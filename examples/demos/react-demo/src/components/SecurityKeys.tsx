import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError, FetchResponse } from "@nhost/nhost-js/fetch";
import { startRegistration } from "@simplewebauthn/browser";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";
import { isWebAuthnSupported } from "../lib/utils";

/**
 * Represents a WebAuthn security key stored for a user
 * - id: Database ID for the key
 * - credentialId: WebAuthn credential identifier
 * - nickname: User-provided friendly name for the key
 */
interface SecurityKey {
  id: string;
  credentialId: string;
  nickname: string | null;
}

/**
 * GraphQL response format for security keys query
 */
interface SecurityKeysResponse {
  data?: {
    authUserSecurityKeys: SecurityKey[];
  };
}

export default function SecurityKeys() {
  const { nhost, isAuthenticated } = useAuth();
  const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState<boolean>(true);

  /**
   * Fetches all registered WebAuthn security keys for the current user
   * These are the public keys stored on the server that correspond to
   * private keys stored securely on the user's devices/authenticators
   */
  const fetchSecurityKeys = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Query the database for all security keys registered to this user
      const response: FetchResponse<SecurityKeysResponse> =
        await nhost.graphql.request({
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

      const userData = response.body?.data;
      const keys = userData?.authUserSecurityKeys || [];
      setSecurityKeys(keys);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setErrorMessage(`Failed to load security keys: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [nhost.graphql]);

  const deleteSecurityKey = async (keyId: string): Promise<void> => {
    if (isDeleting) return;

    setIsDeleting(true);
    setDeletingKeyId(keyId);
    setSuccess(null);
    setErrorMessage(null);

    try {
      // Send request to server to delete the security key
      // This removes the stored public key from the server database
      // so it can no longer be used for authentication
      const response = await nhost.graphql.request({
        query: `
          mutation DeleteSecurityKey($keyId: uuid!) {
            deleteAuthUserSecurityKey(id: $keyId) {
              id
            }
          }
        `,
        variables: {
          keyId,
        },
      });

      if (response.body?.errors) {
        throw new Error(response.body.errors[0]?.message || "Unknown error");
      }

      // Update the UI by removing the key from local state
      setSecurityKeys(securityKeys.filter((key) => key.id !== keyId));
      setSuccess(
        "Security key deleted successfully! Remember to also remove it from your authenticator app, password manager, or device credential manager to avoid future authentication issues.",
      );

      // Hide success message after 5 seconds (increased to give users time to read the reminder)
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      const error = err as Error;
      setErrorMessage(`Failed to delete security key: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setDeletingKeyId(null);
    }
  };

  useEffect(() => {
    // Check if the current browser supports WebAuthn
    // This tests for the presence of the WebAuthn API (PublicKeyCredential and credentials)
    setIsWebAuthnAvailable(isWebAuthnSupported());

    // Load the user's security keys when authenticated
    if (isAuthenticated) {
      fetchSecurityKeys();
    }
  }, [isAuthenticated, fetchSecurityKeys]);

  if (isLoading) {
    return (
      <div className="glass-card p-8 mb-6">
        <h3 className="text-xl mb-4">Security Keys</h3>
        <p>Loading security keys...</p>
      </div>
    );
  }

  const registerNewSecurityKey = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if browser supports WebAuthn
    if (!isWebAuthnAvailable) {
      setErrorMessage(
        "WebAuthn is not supported by your browser. Please use a modern browser that supports WebAuthn.",
      );
      return;
    }

    // Validate key name exists
    if (!keyName.trim()) {
      setErrorMessage("Please provide a name for your security key");
      return;
    }

    setIsRegistering(true);
    setErrorMessage(null);
    setSuccess(null);

    try {
      // Step 1: Request challenge from server
      // The server generates a random challenge to ensure the registration
      // is happening in real-time and creates a new credential ID
      const initResponse = await nhost.auth.addSecurityKey();

      // Step 2: Browser prompts user for security key or biometric verification
      // The browser creates a new credential pair (public/private) and stores
      // the private key securely on the device
      const credential = await startRegistration({
        optionsJSON: initResponse.body,
      });

      if (!credential) {
        setErrorMessage("No credential was selected. Please try again.");
        return;
      }

      // Step 3: Send credential public key back to server for verification
      // The server verifies the attestation and stores the public key
      // associated with the user's account for future authentication
      await nhost.auth.verifyAddSecurityKey({
        credential,
        nickname: keyName.trim(),
      });

      // Step 4: Registration successful - update UI
      setSuccess("Security key registered successfully!");
      setKeyName("");
      setShowAddForm(false);

      // Refresh the security keys list
      fetchSecurityKeys();
    } catch (err) {
      const error = err as Error;
      setErrorMessage(`Failed to register security key: ${error.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const toggleAddForm = () => {
    setShowAddForm(!showAddForm);
    setErrorMessage(null);
    setSuccess(null);
    setKeyName("");
  };

  return (
    <div className="glass-card p-8 mb-6">
      <h3 className="text-xl mb-4">Security Keys</h3>

      {errorMessage && (
        <div className="alert alert-error mb-4">{errorMessage}</div>
      )}

      {success && <div className="alert alert-success mb-4">{success}</div>}

      {!isWebAuthnAvailable && (
        <div className="alert alert-error mb-4">
          <p>
            <strong>WebAuthn not supported!</strong> Your browser or device
            doesn&apos;t support WebAuthn authentication. Please use a modern
            browser (Chrome, Firefox, Safari, Edge) that supports WebAuthn.
          </p>
          <p className="mt-2 text-sm">
            Note: Even if your browser supports WebAuthn, you may need a
            compatible authenticator like a fingerprint reader, facial
            recognition, or a security key (e.g., YubiKey).
          </p>
        </div>
      )}

      {showAddForm ? (
        <div className="space-y-5">
          <p>
            Enter a name for your security key and follow the prompts from your
            browser to register it.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Note: You&apos;ll need a security key (like YubiKey) or a device
            with biometric authentication (like Touch ID, Face ID, or Windows
            Hello). If registration fails, make sure your device has the
            required capabilities.
          </p>
          <p className="text-sm text-gray-400">
            This works the same way as when you registered during sign up.
          </p>

          <form onSubmit={registerNewSecurityKey} className="space-y-4">
            <div>
              <label
                htmlFor="keyName"
                className="block mb-2 text-sm font-medium"
              >
                Security Key Name
              </label>
              <input
                type="text"
                id="keyName"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g., My YubiKey, Touch ID, Windows Hello"
                disabled={isRegistering}
                required
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isRegistering}
              >
                {isRegistering ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      role="img"
                      aria-label="Registering security key"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Complete Registration on Your Device...
                  </>
                ) : (
                  "Register Security Key"
                )}
              </button>
              <button
                type="button"
                onClick={toggleAddForm}
                className="btn btn-secondary"
                disabled={isRegistering}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <p>
            Security Keys (WebAuthn) provide a secure passwordless
            authentication option using hardware security keys, fingerprints, or
            facial recognition.
          </p>

          {/* List of existing security keys */}
          {securityKeys.length === 0 ? (
            <p>No security keys registered.</p>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-3">
                {securityKeys.map((key) => (
                  <li
                    key={key.id}
                    className="flex items-center justify-between border-b border-gray-700 pb-2"
                  >
                    <div>
                      <span className="font-medium">
                        {key.nickname || "Unnamed key"}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        ID: {key.credentialId.slice(0, 8)}...
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSecurityKey(key.id)}
                      disabled={isDeleting && deletingKeyId === key.id}
                      className="action-icon action-icon-delete"
                      title="Delete security key from your account"
                    >
                      {isDeleting && deletingKeyId === key.id ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          role="img"
                          aria-label="Loading"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          role="img"
                          aria-label="Delete"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={toggleAddForm}
            disabled={!isWebAuthnAvailable}
            className="btn btn-primary"
          >
            Register New Security Key
          </button>
        </div>
      )}
    </div>
  );
}
