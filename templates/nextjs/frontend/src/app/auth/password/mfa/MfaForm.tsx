'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import {
  disableMfa,
  enableMfa,
  generateMfa,
  type MfaSetup,
} from '@/app/auth/password/mfa/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NETWORK_ERROR = 'The request did not reach the server. Try again.';

export default function MfaForm({ active }: { active: boolean }) {
  const router = useRouter();
  const codeId = useId();

  const [setup, setSetup] = useState<MfaSetup | undefined>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  // The page reads the account's state from the auth service, so after a
  // change it is re-rendered rather than guessed at here.
  const finish = (): void => {
    setCode('');
    setSetup(undefined);
    router.refresh();
  };

  const handleStart = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await generateMfa();
      if (result.error || !result.setup) {
        setError(result.error ?? 'Could not start the setup.');
        return;
      }

      setSetup(result.setup);
    } catch (err) {
      console.error('Error starting the two-factor setup:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      const result = active ? await disableMfa(code) : await enableMfa(code);
      if (result.error) {
        setError(result.error);
        return;
      }

      finish();
    } catch (err) {
      console.error('Error changing two-factor:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const codeField = (
    <div className="flex flex-col gap-2">
      <Label htmlFor={codeId}>Authenticator code</Label>
      <Input
        id={codeId}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
        disabled={isPending}
      />
    </div>
  );

  const alert = error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;

  if (active) {
    return (
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <p className="text-sm">
          Two-factor is on. Signing in with your password asks for a code from
          your app.
        </p>
        <p className="text-muted-foreground text-sm">
          Enter a current code to turn it off.
        </p>
        {codeField}
        {alert}
        <Button
          type="submit"
          variant="destructive"
          disabled={isPending}
          className="self-center"
        >
          {isPending ? 'Turning off…' : 'Turn off two-factor'}
        </Button>
      </form>
    );
  }

  if (!setup) {
    return (
      // Centred, unlike the two states below: there is no form here, just
      // where the account stands and the one thing to do about it, under a
      // heading and above a link that are both centred themselves.
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm">Two-factor is off.</p>
        {alert}
        <Button
          type="button"
          disabled={isPending}
          onClick={() => void handleStart()}
        >
          {isPending ? 'Starting…' : 'Turn on two-factor'}
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm">
        Scan this with an authenticator app, then enter the code it shows.
      </p>
      {/* biome-ignore lint/performance/noImgElement: a data URL the auth service just generated, nothing for next/image to optimise */}
      <img
        src={setup.imageUrl}
        alt="QR code for the authenticator app"
        width={200}
        height={200}
        className="size-50 rounded-md border bg-white"
      />
      <p className="text-muted-foreground text-sm">
        Or enter this key by hand:{' '}
        <code className="break-all font-mono text-xs">{setup.totpSecret}</code>
      </p>
      {codeField}
      {alert}
      <Button type="submit" disabled={isPending} className="self-center">
        {isPending ? 'Turning on…' : 'Turn on two-factor'}
      </Button>
    </form>
  );
}
