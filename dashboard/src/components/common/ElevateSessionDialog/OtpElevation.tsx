import type { ElevationMethod } from '@nhost/nhost-js/auth';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getElevationErrorMessage } from '@/components/common/ElevateSessionDialog/getElevationErrorMessage';
import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useInterval } from '@/hooks/useInterval';
import { useNhostClient } from '@/providers/nhost';

type OtpMethod = Exclude<ElevationMethod, 'webauthn'>;

const RESEND_COOLDOWN_SECONDS = 30;

interface Props {
  method: OtpMethod;
  onElevated: () => void;
}

function OtpElevation({ method, onElevated }: Props) {
  const nhost = useNhostClient();
  const [resendCooldown, setResendCooldown] = useState(0);

  const sendCode = useMutation<unknown, Error>({
    mutationFn: () =>
      method === 'otp-email'
        ? nhost.auth.elevateOTPEmail()
        : nhost.auth.elevateOTPSms(),
    onSuccess: () => setResendCooldown(RESEND_COOLDOWN_SECONDS),
  });

  const verifyCode = useMutation({
    mutationFn: async (otp: string) => {
      try {
        if (method === 'totp') {
          return await nhost.auth.elevateTotp({ otp });
        }

        if (method === 'otp-email') {
          return await nhost.auth.verifyElevateOTPEmail({ otp });
        }

        return await nhost.auth.verifyElevateOTPSms({ otp });
      } catch (error) {
        throw new Error(
          getElevationErrorMessage(
            error,
            'An error occurred. Please try again.',
          ),
        );
      }
    },
    onSuccess: () => onElevated(),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: request the code once on mount
  useEffect(() => {
    if (method !== 'totp') {
      sendCode.mutate();
    }
  }, []);

  useInterval(
    () => setResendCooldown((seconds) => seconds - 1),
    resendCooldown > 0 ? 1000 : null,
  );

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
          <AlertTitle>Couldn&apos;t send the code</AlertTitle>
          <AlertDescription>
            {getElevationErrorMessage(
              sendCode.error,
              'Please try again in a few moments.',
            )}
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
          disabled={verifyCode.isPending || resendCooldown > 0}
          onClick={() => sendCode.mutate()}
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : 'Resend code'}
        </Button>
      )}
    </>
  );
}

export default OtpElevation;
