import { startAuthentication } from '@simplewebauthn/browser';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useUserData } from '@/hooks/useUserData';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

interface Props {
  onElevated: () => void;
}

function WebauthnElevation({ onElevated }: Props) {
  const nhost = useNhostClient();
  const user = useUserData();
  const [isVerifying, setIsVerifying] = useState(true);

  async function verify() {
    setIsVerifying(true);

    try {
      const { body } = await nhost.auth.elevateWebauthn();
      const credential = await startAuthentication(body);
      await nhost.auth.verifyElevateWebauthn({
        email: user?.email,
        credential,
      });
      onElevated();
    } catch (error) {
      toast.error(
        error?.message || 'Could not verify your security key.',
        getToastStyleProps(),
      );
      setIsVerifying(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: start the ceremony once on mount
  useEffect(() => {
    verify();
  }, []);

  if (isVerifying) {
    return (
      <Spinner size="small" wrapperClassName="gap-2">
        Waiting for your security key...
      </Spinner>
    );
  }

  return (
    <Button onClick={verify} className="w-full">
      Try again
    </Button>
  );
}

export default WebauthnElevation;
