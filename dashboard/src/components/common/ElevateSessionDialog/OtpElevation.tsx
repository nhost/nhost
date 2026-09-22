import type { ElevationMethod } from '@nhost/nhost-js/auth';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

type OtpMethod = Exclude<ElevationMethod, 'webauthn'>;

interface Props {
  method: OtpMethod;
  onElevated: () => void;
}

function OtpElevation({ method, onElevated }: Props) {
  const nhost = useNhostClient();
  const [isSendingCode, setIsSendingCode] = useState(method !== 'totp');
  const [codeSent, setCodeSent] = useState(method === 'totp');
  const [isVerifying, setIsVerifying] = useState(false);

  async function sendCode() {
    setIsSendingCode(true);

    try {
      if (method === 'otp-email') {
        await nhost.auth.elevateOTPEmail();
      } else {
        await nhost.auth.elevateOTPSms();
      }

      setCodeSent(true);
    } catch (error) {
      toast.error(
        error?.message || 'Could not send the code. Please try again.',
        getToastStyleProps(),
      );
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
      <Spinner size="small" wrapperClassName="gap-2">
        Sending the code...
      </Spinner>
    );
  }

  if (!codeSent) {
    return (
      <Button onClick={sendCode} className="w-full">
        Try again
      </Button>
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
