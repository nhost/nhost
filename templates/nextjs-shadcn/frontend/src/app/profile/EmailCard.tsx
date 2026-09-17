'use client';

import { BadgeAlert, BadgeCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { changeEmail } from '@/app/profile/actions';
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
}: {
  email: string;
  emailVerified: boolean;
  newEmail?: string | null;
}) {
  const [changing, setChanging] = useState(false);
  const [nextEmail, setNextEmail] = useState('');
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const pendingEmail = requested ? nextEmail : newEmail;

  const handleChangeEmail = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsSaving(true);

    const result = await changeEmail(nextEmail);
    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setRequested(true);
    setChanging(false);
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
          <form className="flex items-end gap-2" onSubmit={handleChangeEmail}>
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
            <Button type="submit" disabled={isSaving || !nextEmail}>
              {isSaving ? 'Sending…' : 'Send confirmation'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                setChanging(false);
                setError(undefined);
              }}
            >
              Cancel
            </Button>
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
