'use client';

import { BadgeAlert, BadgeCheck } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { changeEmail, sendReauthCode } from '@/app/profile/actions';
import { MailboxHint } from '@/components/MailboxHint';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Says whether auth has seen this address confirmed.
 *
 * A mark on its own does not explain itself, so it names itself on hover and
 * on focus. The unverified state is drawn rather than left out: nothing at all
 * is indistinguishable from a page that simply does not report it.
 */
function VerifiedBadge({ verified }: { verified: boolean }) {
  const label = verified ? 'Email verified' : 'Email not verified';

  const Icon = verified ? BadgeCheck : BadgeAlert;

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className={
          verified
            ? 'text-emerald-600 dark:text-emerald-500'
            : 'text-muted-foreground'
        }
      >
        <Icon className="size-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function EmailCard({
  email,
  emailVerified,
  newEmail,
  hasPassword,
}: {
  email: string;
  emailVerified: boolean;
  newEmail?: string | null;
  hasPassword: boolean;
}) {
  const currentId = useId();
  const [changing, setChanging] = useState(false);
  const [nextEmail, setNextEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [requestedEmail, setRequestedEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const pendingEmail = requestedEmail || newEmail;

  const handleSendCode = async (): Promise<void> => {
    setError(undefined);
    setIsSendingCode(true);
    try {
      const result = await sendReauthCode();
      if (result.error) {
        setError(result.error);
        return;
      }
      setCodeSent(true);
    } catch (err) {
      console.error('Could not send the code:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleChangeEmail = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsSaving(true);
    try {
      // Pass `current` unconditionally: gating it on `hasPassword` is the
      // bug that shipped and was rejected before.
      const result = await changeEmail(nextEmail, current);
      if (result.error) {
        setError(result.error);
        return;
      }

      setRequestedEmail(nextEmail);
      setNextEmail('');
      setCurrent('');
      setChanging(false);
    } catch (err) {
      console.error('Could not change the email:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // Tighter than the default card: the address belongs with the line above it
    // rather than sitting a whole section away from it.
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>
          Changing it needs confirming from the new address.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {changing ? (
          <form className="flex flex-col gap-2" onSubmit={handleChangeEmail}>
            <Input
              type="email"
              autoComplete="email"
              aria-label="New email address"
              placeholder="you@example.com"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              disabled={isSaving}
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor={currentId}>
                {hasPassword ? 'Current password' : 'Code from your email'}
              </Label>
              {hasPassword ? (
                <Input
                  id={currentId}
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  disabled={isSaving}
                  required
                />
              ) : (
                <div className="flex gap-2">
                  <Input
                    id={currentId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={current}
                    onChange={(event) => setCurrent(event.target.value)}
                    disabled={isSaving}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendCode}
                    disabled={isSaving || isSendingCode}
                  >
                    {isSendingCode
                      ? 'Sending…'
                      : codeSent
                        ? 'Resend'
                        : 'Send code'}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="submit"
                disabled={isSaving || !nextEmail || !current}
              >
                {isSaving ? 'Sending…' : 'Send confirmation'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isSaving}
                onClick={() => {
                  setChanging(false);
                  setCurrent('');
                  setError(undefined);
                  setCodeSent(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center gap-1.5 text-sm">
              {email}
              <VerifiedBadge verified={emailVerified} />
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => setChanging(true)}
            >
              Change
            </Button>
          </div>
        )}

        {pendingEmail ? (
          <p className="text-muted-foreground text-sm">
            Waiting for you to confirm {pendingEmail}.
            <MailboxHint />
          </p>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
