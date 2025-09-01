import { useState, useEffect, type JSX } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";

interface MFASettingsProps {
  initialMfaEnabled: boolean;
}

export default function MFASettings({
  initialMfaEnabled,
}: MFASettingsProps): JSX.Element {
  const [isMfaEnabled, setIsMfaEnabled] = useState<boolean>(initialMfaEnabled);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { nhost } = useAuth();

  // Update internal state when prop changes
  useEffect(() => {
    if (initialMfaEnabled !== isMfaEnabled) {
      setIsMfaEnabled(initialMfaEnabled);
    }
  }, [initialMfaEnabled, isMfaEnabled]);

  // MFA setup states
  const [isSettingUpMfa, setIsSettingUpMfa] = useState<boolean>(false);
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");

  // Disabling MFA states
  const [isDisablingMfa, setIsDisablingMfa] = useState<boolean>(false);
  const [disableVerificationCode, setDisableVerificationCode] =
    useState<string>("");

  // Begin MFA setup process
  const handleEnableMfa = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate TOTP secret
      const response = await nhost.auth.changeUserMfa();
      setTotpSecret(response.body.totpSecret);
      setQrCodeUrl(response.body.imageUrl);
      setIsSettingUpMfa(true);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred while enabling MFA: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify TOTP and enable MFA
  const handleVerifyTotp = async (): Promise<void> => {
    if (!verificationCode) {
      setError("Please enter the verification code");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Verify and activate MFA
      await nhost.auth.verifyChangeUserMfa({
        activeMfaType: "totp",
        code: verificationCode,
      });

      setIsMfaEnabled(true);
      setIsSettingUpMfa(false);
      setSuccess("MFA has been successfully enabled.");
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred while verifying the code: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Show disable MFA confirmation
  const handleShowDisableMfa = (): void => {
    setIsDisablingMfa(true);
    setError(null);
    setSuccess(null);
  };

  // Disable MFA
  const handleDisableMfa = async (): Promise<void> => {
    if (!disableVerificationCode) {
      setError("Please enter your verification code to confirm");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Disable MFA by setting activeMfaType to empty string
      await nhost.auth.verifyChangeUserMfa({
        activeMfaType: "",
        code: disableVerificationCode,
      });

      setIsMfaEnabled(false);
      setIsDisablingMfa(false);
      setDisableVerificationCode("");
      setSuccess("MFA has been successfully disabled.");
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred while disabling MFA: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel MFA setup
  const handleCancelMfaSetup = (): void => {
    setIsSettingUpMfa(false);
    setTotpSecret("");
    setQrCodeUrl("");
    setVerificationCode("");
  };

  // Cancel MFA disable
  const handleCancelMfaDisable = (): void => {
    setIsDisablingMfa(false);
    setDisableVerificationCode("");
    setError(null);
  };

  return (
    <div className="glass-card p-8 mb-6">
      <h3 className="text-xl mb-4">Multi-Factor Authentication</h3>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      {success && <div className="alert alert-success mb-4">{success}</div>}

      {isSettingUpMfa ? (
        <div className="space-y-5">
          <p>
            Scan this QR code with your authenticator app (e.g., Google
            Authenticator, Authy):
          </p>

          {qrCodeUrl && (
            <div className="flex justify-center my-4">
              <div className="p-2 bg-white rounded-md">
                <img
                  src={qrCodeUrl}
                  alt="TOTP QR Code"
                  width="200"
                  height="200"
                />
              </div>
            </div>
          )}

          <p>Or manually enter this secret key:</p>
          <div className="p-2 bg-gray-100 rounded text-center text-black">
            {totpSecret}
          </div>

          <div>
            <label htmlFor="verification-code">Verification Code</label>
            <input
              id="verification-code"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleVerifyTotp}
              disabled={isLoading || !verificationCode}
              className="btn btn-primary"
            >
              {isLoading ? "Verifying..." : "Verify and Enable"}
            </button>

            <button
              onClick={handleCancelMfaSetup}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : isDisablingMfa ? (
        <div className="space-y-5">
          <p>
            To disable Multi-Factor Authentication, please enter the current
            verification code from your authenticator app.
          </p>

          <div>
            <label htmlFor="disable-verification-code">
              Current Verification Code
            </label>
            <input
              id="disable-verification-code"
              type="text"
              value={disableVerificationCode}
              onChange={(e) => setDisableVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleDisableMfa}
              disabled={isLoading || !disableVerificationCode}
              className="btn btn-primary"
            >
              {isLoading ? "Disabling..." : "Confirm Disable"}
            </button>

            <button
              onClick={handleCancelMfaDisable}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p>
            Multi-Factor Authentication adds an extra layer of security to your
            account by requiring a verification code from your authenticator app
            when signing in.
          </p>

          <div className="flex items-center">
            <span className="mr-3">Status:</span>
            <span
              className={`font-semibold ${isMfaEnabled ? "text-green-500" : "text-yellow-500"}`}
            >
              {isMfaEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {isMfaEnabled ? (
            <button
              onClick={handleShowDisableMfa}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              {isLoading ? "Processing..." : "Disable MFA"}
            </button>
          ) : (
            <button
              onClick={handleEnableMfa}
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? "Loading..." : "Enable MFA"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
