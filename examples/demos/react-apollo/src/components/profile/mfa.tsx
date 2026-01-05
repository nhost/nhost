import { useState, useEffect } from "react";
import { useNhostClient } from "@/providers/nhost";
import { useAuth } from "@/providers/auth";
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { useSecurity } from "@/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Shield, ShieldCheck, QrCode, Copy } from "lucide-react";

interface MfaStatusQuery {
  users: {
    id: string;
    activeMfaType: string | null;
  }[];
}

export default function MFASettings() {
  const { user } = useAuth();
  const [isMfaEnabled, setIsMfaEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const nhost = useNhostClient();
  const { requiresElevation, checkElevation } = useSecurity();

  // MFA setup states
  const [isSettingUpMfa, setIsSettingUpMfa] = useState<boolean>(false);
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");

  // Disabling MFA states
  const [isDisablingMfa, setIsDisablingMfa] = useState<boolean>(false);
  const [disableVerificationCode, setDisableVerificationCode] =
    useState<string>("");

  // Fetch MFA status from database
  useEffect(() => {
    const fetchMfaStatus = async () => {
      if (!user?.id) return;

      setIsLoadingStatus(true);
      try {
        const response = await nhost.graphql.request<MfaStatusQuery>({
          query: `
            query GetMfaStatus($userId: uuid!) {
              users(where: { id: { _eq: $userId } }) {
                id
                activeMfaType
              }
            }
          `,
          variables: { userId: user.id },
        });
        console.log(response.body.data);

        if (response.body.data?.users?.[0]) {
          const mfaType = response.body.data?.users[0].activeMfaType;
          setIsMfaEnabled(mfaType === "totp");
        }
      } catch (error) {
        console.error("Failed to fetch MFA status:", error);
        toast.error("Failed to load MFA status");
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchMfaStatus();
  }, [user?.id, nhost]);

  // Begin MFA setup process
  const handleEnableMfa = async (): Promise<void> => {
    setIsLoading(true);

    try {
      // Check if elevation is required before enabling MFA
      if (requiresElevation) {
        await checkElevation();
      }

      // Generate TOTP secret
      const response = await nhost.auth.changeUserMfa();
      setTotpSecret(response.body.totpSecret);
      setQrCodeUrl(response.body.imageUrl);
      setIsSettingUpMfa(true);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      toast.error(`Failed to enable MFA: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify TOTP and enable MFA
  const handleVerifyTotp = async (): Promise<void> => {
    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    setIsLoading(true);

    try {
      // Verify and activate MFA
      await nhost.auth.verifyChangeUserMfa({
        activeMfaType: "totp",
        code: verificationCode,
      });

      setIsMfaEnabled(true);
      setIsSettingUpMfa(false);
      setVerificationCode("");
      toast.success("MFA has been successfully enabled");
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      toast.error(`Failed to verify code: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Show disable MFA confirmation
  const handleShowDisableMfa = (): void => {
    setIsDisablingMfa(true);
    setDisableVerificationCode("");
  };

  // Disable MFA
  const handleDisableMfa = async (): Promise<void> => {
    if (!disableVerificationCode.trim()) {
      toast.error("Please enter your verification code to confirm");
      return;
    }

    setIsLoading(true);

    try {
      // Check if elevation is required before disabling MFA
      if (requiresElevation) {
        await checkElevation();
      }

      // Disable MFA by setting activeMfaType to empty string
      await nhost.auth.verifyChangeUserMfa({
        activeMfaType: "",
        code: disableVerificationCode,
      });

      setIsMfaEnabled(false);
      setIsDisablingMfa(false);
      setDisableVerificationCode("");
      toast.success("MFA has been successfully disabled");
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      toast.error(`Failed to disable MFA: ${error.message}`);
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
  };

  // Copy secret to clipboard
  const handleCopySecret = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(totpSecret);
      toast.success("Secret copied to clipboard");
    } catch {
      toast.error("Failed to copy secret");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <CardTitle>Multi-Factor Authentication</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="flex items-center gap-1">
            {isLoadingStatus ? (
              <>
                <Shield className="w-4 h-4 text-muted-foreground animate-pulse" />
                <span className="text-sm font-medium text-muted-foreground">
                  Loading...
                </span>
              </>
            ) : isMfaEnabled ? (
              <>
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">
                  Enabled
                </span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">
                  Disabled
                </span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">
              Loading MFA status...
            </div>
          </div>
        ) : isSettingUpMfa ? (
          <div className="space-y-6">
            <Alert>
              <QrCode className="w-4 h-4" />
              <AlertDescription>
                Scan the QR code below with your authenticator app (Google
                Authenticator, Authy, etc.) or manually enter the secret key.
              </AlertDescription>
            </Alert>

            {qrCodeUrl && (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <img
                    src={qrCodeUrl}
                    alt="TOTP QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Or manually enter this secret key:</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-muted rounded-md font-mono text-sm">
                  {totpSecret}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopySecret}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleVerifyTotp}
                disabled={isLoading || !verificationCode.trim()}
              >
                {isLoading ? "Verifying..." : "Verify and Enable"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelMfaSetup}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : isDisablingMfa ? (
          <div className="space-y-6">
            <Alert>
              <AlertDescription>
                To disable Multi-Factor Authentication, please enter the current
                verification code from your authenticator app.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="disable-verification-code">
                Current Verification Code
              </Label>
              <Input
                id="disable-verification-code"
                type="text"
                value={disableVerificationCode}
                onChange={(e) => setDisableVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleDisableMfa}
                disabled={isLoading || !disableVerificationCode.trim()}
                variant="destructive"
              >
                {isLoading ? "Disabling..." : "Confirm Disable"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelMfaDisable}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Alert>
              <AlertDescription>
                Multi-Factor Authentication adds an extra layer of security to
                your account by requiring a verification code from your
                authenticator app when signing in.
              </AlertDescription>
            </Alert>

            <Separator />

            {isMfaEnabled ? (
              <Button
                variant="destructive"
                onClick={handleShowDisableMfa}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Disable MFA"}
              </Button>
            ) : (
              <Button onClick={handleEnableMfa} disabled={isLoading}>
                {isLoading ? "Loading..." : "Enable MFA"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
