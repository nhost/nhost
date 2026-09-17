'use client';

import { type FormEvent, useId, useState } from 'react';
import { changeEmail } from '@/app/profile/actions';
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
import { localMailboxURL } from '@/lib/nhost/env';

const mailbox = localMailboxURL();

export function EmailCard({
  email,
  newEmail,
}: {
  email: string;
  newEmail?: string | null;
}) {
  const emailId = useId();

  const [nextEmail, setNextEmail] = useState('');
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const pending = requested ? nextEmail : newEmail;

  const handleChange = async (event: FormEvent<HTMLFormElement>) => {
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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>
          You sign in as <strong>{email}</strong>. A change only takes effect
          after you confirm it from the new address.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex items-end gap-2" onSubmit={handleChange}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={emailId}>New email</Label>
            <Input
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              disabled={isSaving}
            />
          </div>
          <Button type="submit" disabled={isSaving || !nextEmail}>
            {isSaving ? 'Requesting…' : 'Change email'}
          </Button>
        </form>

        {pending ? (
          <p className="text-muted-foreground text-sm">
            Waiting for you to confirm {pending}.
            {mailbox ? (
              <>
                {' '}
                Running locally, so the confirmation is in{' '}
                <a
                  href={mailbox}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  the local mailbox
                </a>
                .
              </>
            ) : null}
          </p>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
