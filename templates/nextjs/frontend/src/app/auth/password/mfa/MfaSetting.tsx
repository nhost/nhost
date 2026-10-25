'use client';

import type { User } from '@nhost/nhost-js/auth';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import {
  disableMfa,
  enableMfa,
  generateMfa,
  type MfaSetup,
} from '@/app/auth/password/mfa/actions';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { DialogSetting } from '@/components/Setting';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const NETWORK_ERROR = 'The request did not reach the server. Try again.';

/**
 * Two-factor, as a row on the account page.
 *
 * The auth service turns it on only once a code from the app proves the app
 * holds the secret, and turns it off only with a current code, so opening
 * the dialog is the first step either way. Opened while it is off, it asks
 * for a secret straight away, since showing the QR code is the only thing
 * there is to do.
 */
export default function MfaSetting({ user }: { user: User }) {
  const active = user.activeMfaType === 'totp';
  const router = useRouter();
  const toast = useToast();
  const codeId = useId();
  const hintId = useId();

  const [open, setOpen] = useState(false);
  // Which way the dialog was opened. Kept apart from `active` so the form
  // stays as it was while the page comes back with the new state, rather
  // than flipping to the other one under the visitor.
  const [turningOff, setTurningOff] = useState(active);
  const [setup, setSetup] = useState<MfaSetup | undefined>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const start = async (): Promise<void> => {
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

  const handleOpen = (): void => {
    setCode('');
    setError(undefined);
    setTurningOff(active);
    // A fresh secret on every opening. The backend stores it on the account
    // right away, and one shown earlier and closed is not worth keeping.
    if (!active) {
      setSetup(undefined);
      void start();
    }
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      const result = turningOff
        ? await disableMfa(code)
        : await enableMfa(code);
      if (result.error) {
        setError(result.error);
        return;
      }

      // The page reads the account's state from the auth service, so the
      // row changes when it is rendered again rather than being guessed at
      // here.
      setOpen(false);
      setCode('');
      toast(turningOff ? 'Two-factor is off' : 'Two-factor is on');
      router.refresh();
    } catch (err) {
      console.error('Error changing two-factor:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const ready = turningOff || setup !== undefined;
  const turning = turningOff ? 'off' : 'on';

  return (
    <DialogSetting
      label="Two-factor"
      value={
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              active ? 'bg-success' : 'bg-muted-foreground/60',
            )}
          />
          {active ? 'On' : 'Off'}
        </span>
      }
      action={active ? 'Turn off' : 'Set up'}
      title={turningOff ? 'Turn off two-factor' : 'Set up two-factor'}
      description={
        turningOff
          ? 'Enter a current code from your authenticator app to turn it off.'
          : 'Scan the code with an authenticator app, then enter the 6 digit code it shows.'
      }
      open={open}
      onOpenChange={setOpen}
      onOpen={handleOpen}
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {!turningOff && setup ? (
          <div className="flex flex-col items-center gap-2 text-center">
            {/* biome-ignore lint/performance/noImgElement: a data URL the auth service just generated, nothing for next/image to optimise */}
            <img
              src={setup.imageUrl}
              alt="QR code for the authenticator app"
              width={160}
              height={160}
              className="size-40 rounded-lg border-8 border-white bg-white"
            />
            <p className="text-muted-foreground text-xs">
              Or enter this key by hand:{' '}
              <code className="break-all font-mono">{setup.totpSecret}</code>
            </p>
          </div>
        ) : null}

        {!ready && isPending ? (
          <p className="text-center text-muted-foreground text-sm">
            Preparing a code to scan…
          </p>
        ) : null}

        {ready ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={codeId}>Code</Label>
            <Input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isPending}
              aria-describedby={turningOff ? undefined : hintId}
              className="font-mono tracking-widest"
            />
            {/* What it covers, under the field it is about, since the
                answer to "will this lock me out of X" is no for everything
                but the password. */}
            {turningOff ? null : (
              <p id={hintId} className="text-muted-foreground text-xs">
                Only signing in with your password will ask for this code. Other
                sign-in methods and links sent by email, including password
                reset, won't.
              </p>
            )}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose disabled={isPending && ready} />
          {ready ? (
            <Button
              type="submit"
              size="sm"
              variant={turningOff ? 'destructive' : 'default'}
              disabled={isPending || !/^\d{6}$/.test(code.trim())}
            >
              {isPending ? `Turning ${turning}…` : `Turn ${turning}`}
            </Button>
          ) : null}
        </DialogFooter>
      </form>
    </DialogSetting>
  );
}
