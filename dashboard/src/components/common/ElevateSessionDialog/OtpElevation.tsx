import type { ElevationMethod } from '@nhost/nhost-js/auth';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useNhostClient } from '@/providers/nhost';

type OtpMethod = Exclude<ElevationMethod, 'webauthn'>;

interface Props {
  method: OtpMethod;
  onElevated: () => void;
}

function OtpElevation({ method, onElevated }: Props) {
  const nhost = useNhostClient();
  const [isSendingCode, setIsSendingCode] = useState(method !== 'totp');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  async function sendCode() {
    setIsSendingCode(true);
    setSendError(null);

    try {
      if (method === 'otp-email') {
        await nhost.auth.elevateOTPEmail();
      } else {
        await nhost.auth.elevateOTPSms();
      }
    } catch (error) {
      setSendError(error?.message || 'Please try again in a few moments.');
    } finally {
      setIsSendingCode(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: request the code once on mount
  useEffect(() => {
    if (method !== 'totp') {
      sendCode();
    }
  }, []);

  async function verify(otp: string) {
    setIsVerifying(true);

    try {
      if (method === 'totp') {
        await nhost.auth.elevateTotp({ otp });
      } else if (method === 'otp-email') {
        await nhost.auth.verifyElevateOTPEmail({ otp });
      } else {
        await nhost.auth.verifyElevateOTPSms({ otp });
      }

      onElevated();
    } finally {
      setIsVerifying(false);
    }
  }

  if (isSendingCode) {
    return (
      <Spinner size="xs" wrapperClassName="flex-row justify-center gap-1.5">
        <span className="text-muted-foreground text-xs">
          Sending the code...
        </span>
      </Spinner>
    );
  }

  if (sendError) {
    return (
      <>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t send the code</AlertTitle>
          <AlertDescription>{sendError}</AlertDescription>
        </Alert>
        <Button onClick={sendCode}>Resend code</Button>
      </>
    );
  }

  return (
    <MfaOtpForm
      loading={isVerifying}
      sendMfaOtp={verify}
      placeholder="Enter the 6-digit code"
    />
  );
}

export default OtpElevation;
