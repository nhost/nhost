'use client';

import type { User } from '@nhost/nhost-js/auth';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useRef, useState } from 'react';
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
  // What a change here made it, until the refreshed page agrees: reopening
  // the dialog before then would otherwise offer the change just made.
  // Kept with the state it changed from, so a page that has moved on since
  // wins over it.
  const reported = user.activeMfaType === 'totp';
  const [changed, setChanged] = useState<{ from: boolean; to: boolean }>();
  const active = changed?.from === reported ? changed.to : reported;
  const router = useRouter();
  const toast = useToast();
  // The copied key's toast goes when the dialog does: it is about a key
  // that is no longer on screen.
  const dismissCopied = useRef<VoidFunction>(undefined);
  const codeId = useId();

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
      setChanged({ from: reported, to: !turningOff });
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

  // Typing a key this long from the screen is where entering it by hand goes
  // wrong, so it can be pasted instead.
  const copyKey = async (key: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(key);
      dismissCopied.current = toast('Key copied');
    } catch (err) {
      console.error('Error copying the two-factor key:', err);
      toast('Could not copy the key');
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
          : 'Asks for a code from an authenticator app when you sign in with your password. Other sign-in methods and emailed links skip it.'
      }
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dismissCopied.current?.();
        }
        setOpen(next);
      }}
      onOpen={handleOpen}
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {/* Setting up is two steps, numbered so the dialog reads top to
            bottom: get the key into the app, then prove it with a code.
            Both are laid out from the moment it opens, with the room for
            the QR code and the key held while the auth service makes them,
            so the dialog does not grow when they arrive. */}
        {turningOff ? null : (
          <div className="flex flex-col gap-3">
            <p className="font-medium text-sm">
              1. Scan this QR code with your authenticator app.
            </p>
            <div className="flex flex-col items-center gap-2 text-center">
              {setup ? (
                // biome-ignore lint/performance/noImgElement: a data URL the auth service just generated, nothing for next/image to optimise
                <img
                  src={setup.imageUrl}
                  alt="QR code for the authenticator app"
                  width={160}
                  height={160}
                  className="size-40 rounded-lg border-8 border-white bg-white"
                />
              ) : (
                <div className="flex size-40 items-center justify-center rounded-lg bg-muted px-4 text-muted-foreground text-xs">
                  {isPending ? 'Preparing a code to scan…' : null}
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                Can't scan it? Enter this key instead:
              </p>
              {/* In groups of four, the way authenticator apps show a key, so
                  it reads in chunks and wraps between them into even lines,
                  with the copy button after the last. It copies the key
                  without the spaces. Two lines' room either way. */}
              <p className="min-h-10 max-w-xs text-balance text-muted-foreground text-xs">
                {setup ? (
                  <>
                    <code className="font-mono tracking-wide">
                      {setup.totpSecret.match(/.{1,4}/g)?.join(' ')}
                    </code>
                    <button
                      type="button"
                      aria-label="Copy key"
                      title="Copy key"
                      onClick={() => void copyKey(setup.totpSecret)}
                      className="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md align-middle outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-3.5"
                      >
                        <rect x="9" y="9" width="12" height="12" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                      </svg>
                    </button>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={codeId}>
            {turningOff ? 'Code' : '2. Enter the 6-digit code.'}
          </Label>
          <Input
            id={codeId}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={isPending || !ready}
            className="font-mono tracking-widest"
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose disabled={isPending && ready} />
          <Button
            type="submit"
            size="sm"
            variant={turningOff ? 'destructive' : 'default'}
            disabled={isPending || !ready || !/^\d{6}$/.test(code.trim())}
          >
            {isPending && ready ? `Turning ${turning}…` : `Turn ${turning}`}
          </Button>
        </DialogFooter>
      </form>
    </DialogSetting>
  );
}
