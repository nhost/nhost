import { startAuthentication } from '@simplewebauthn/browser';
import { useEffect, useState } from 'react';
import { getElevationErrorMessage } from '@/components/common/ElevateSessionDialog/getElevationErrorMessage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useUserData } from '@/hooks/useUserData';
import { useNhostClient } from '@/providers/nhost';

interface Props {
  onElevated: () => void;
}

function WebauthnElevation({ onElevated }: Props) {
  const nhost = useNhostClient();
  const user = useUserData();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setIsVerifying(true);
    setError(null);

    try {
      const { body } = await nhost.auth.elevateWebauthn();
      const credential = await startAuthentication(body);
      await nhost.auth.verifyElevateWebauthn({
        email: user?.email,
        credential,
      });
      onElevated();
    } catch (err) {
      setError(
        getElevationErrorMessage(
          err,
          'Make sure your security key is connected and try again.',
        ),
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
      <Spinner size="xs" wrapperClassName="flex-row justify-center gap-1.5">
        <span className="text-muted-foreground text-xs">
          Waiting for your security key...
        </span>
      </Spinner>
    );
  }

  return (
    <>
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t verify your security key</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      <Button onClick={verify}>Try again</Button>
    </>
  );
}

export default WebauthnElevation;
