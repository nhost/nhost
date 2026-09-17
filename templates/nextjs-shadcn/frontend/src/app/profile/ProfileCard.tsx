'use client';

import { BadgeCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { AvatarPicker } from '@/app/profile/AvatarPicker';
import { changeEmail, updateDisplayName } from '@/app/profile/actions';
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

function MailboxHint() {
  if (!mailbox) {
    return null;
  }

  return (
    <>
      {' '}
      Running locally, so it never leaves your machine:{' '}
      <a
        href={mailbox}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        open the local mailbox
      </a>
      .
    </>
  );
}

export function ProfileCard({
  email,
  emailVerified,
  displayName,
  newEmail,
  avatarUrl,
}: {
  email: string;
  emailVerified: boolean;
  displayName?: string | null;
  newEmail?: string | null;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const nameId = useId();
  const emailId = useId();

  const [name, setName] = useState(displayName ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [isSavingName, setIsSavingName] = useState(false);

  const [changingEmail, setChangingEmail] = useState(false);
  const [nextEmail, setNextEmail] = useState('');
  const [requested, setRequested] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const pendingEmail = requested ? nextEmail : newEmail;
  const nameChanged = name.trim() !== (displayName ?? '').trim();

  const handleSaveName = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setNameError(undefined);
    setIsSavingName(true);

    const result = await updateDisplayName(name);
    setIsSavingName(false);

    if (result.error) {
      setNameError(result.error);
      return;
    }

    router.refresh();
  };

  const handleChangeEmail = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setEmailError(undefined);
    setIsSavingEmail(true);

    const result = await changeEmail(nextEmail);
    setIsSavingEmail(false);

    if (result.error) {
      setEmailError(result.error);
      return;
    }

    setRequested(true);
    setChangingEmail(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          The avatar goes through a serverless function and storage. The name
          and email go through auth and per-user GraphQL permissions.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
        <AvatarPicker
          email={email}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />

        <div className="flex flex-1 flex-col gap-5">
          <form className="flex items-end gap-2" onSubmit={handleSaveName}>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={nameId}>Display name</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                disabled={isSavingName}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={isSavingName || !nameChanged || !name.trim()}
            >
              {isSavingName ? 'Saving…' : 'Save'}
            </Button>
          </form>

          <div className="flex flex-col gap-2">
            <Label htmlFor={changingEmail ? emailId : undefined}>Email</Label>

            {changingEmail ? (
              <form
                className="flex items-end gap-2"
                onSubmit={handleChangeEmail}
              >
                <Input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={nextEmail}
                  onChange={(event) => setNextEmail(event.target.value)}
                  disabled={isSavingEmail}
                  autoFocus
                />
                <Button type="submit" disabled={isSavingEmail || !nextEmail}>
                  {isSavingEmail ? 'Sending…' : 'Send confirmation'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSavingEmail}
                  onClick={() => {
                    setChangingEmail(false);
                    setEmailError(undefined);
                  }}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex flex-1 items-center gap-1.5 text-sm">
                  {email}
                  {emailVerified ? (
                    <BadgeCheck
                      className="size-4 text-muted-foreground"
                      aria-label="Verified"
                    />
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChangingEmail(true)}
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

            {emailError ? (
              <p className="text-destructive text-sm">{emailError}</p>
            ) : null}
          </div>

          {nameError ? (
            <p className="text-destructive text-sm">{nameError}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
