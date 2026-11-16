import type { ElevationMethod } from '@nhost/nhost-js/auth';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';
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

  const sendCode = useMutation<unknown, Error>({
    mutationFn: () =>
      method === 'otp-email'
        ? nhost.auth.elevateOTPEmail()
        : nhost.auth.elevateOTPSms(),
  });

  const verifyCode = useMutation({
    mutationFn: (otp: string) => {
      if (method === 'totp') {
        return nhost.auth.elevateTotp({ otp });
      }

      if (method === 'otp-email') {
        return nhost.auth.verifyElevateOTPEmail({ otp });
      }

      return nhost.auth.verifyElevateOTPSms({ otp });
    },
    onSuccess: () => onElevated(),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: request the code once on mount
  useEffect(() => {
    if (method !== 'totp') {
      sendCode.mutate();
    }
  }, []);

  if (method !== 'totp' && (sendCode.isIdle || sendCode.isPending)) {
    return (
      <Spinner size="xs" wrapperClassName="flex-row justify-center gap-1.5">
        <span className="text-muted-foreground text-xs">
          Sending the code...
        </span>
      </Spinner>
    );
  }

  if (sendCode.isError) {
    return (
      <>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t send the code</AlertTitle>
          <AlertDescription>
            {sendCode.error.message || 'Please try again in a few moments.'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => sendCode.mutate()}>Resend code</Button>
      </>
    );
  }

  return (
    <>
      <MfaOtpForm
        loading={verifyCode.isPending}
        sendMfaOtp={verifyCode.mutateAsync}
        placeholder="Enter the 6-digit code"
      />
      {method !== 'totp' && (
        <Button
          variant="outline"
          disabled={verifyCode.isPending}
          onClick={() => sendCode.mutate()}
        >
          Resend code
        </Button>
      )}
    </>
  );
}

export default OtpElevation;
