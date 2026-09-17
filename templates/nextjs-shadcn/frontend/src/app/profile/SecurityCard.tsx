'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { changePassword, sendOwnPasswordReset } from '@/app/profile/actions';
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

// Matches auth.method.emailPassword.passwordMinLength in the backend config.
const MIN_PASSWORD_LENGTH = 9;

export function SecurityCard({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const currentId = useId();
  const newId = useId();

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const reset = (): void => {
    setEditing(false);
    setCurrent('');
    setPassword('');
    setError(undefined);
  };

  const handleSave = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    setIsSaving(true);

    const result = await changePassword(
      password,
      hasPassword ? current : undefined,
    );
    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    reset();
    setNotice(hasPassword ? 'Password changed.' : 'Password set.');
    router.refresh();
  };

  const handleSendReset = async (): Promise<void> => {
    setError(undefined);
    setNotice(undefined);
    setIsSendingReset(true);

    const result = await sendOwnPasswordReset();
    setIsSendingReset(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNotice('Reset link sent. Check your email.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          {hasPassword
            ? 'You can sign in with either a password or an emailed code.'
            : 'You sign in with an emailed code. Set a password to also sign in with one.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            {hasPassword ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={currentId}>Current password</Label>
                <Input
                  id={currentId}
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor={newId}>New password</Label>
              <Input
                id={newId}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSaving}
                required
              />
              <p className="text-muted-foreground text-sm">
                At least {MIN_PASSWORD_LENGTH} characters. Other devices are
                signed out.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  password.length < MIN_PASSWORD_LENGTH ||
                  (hasPassword && !current)
                }
              >
                {isSaving
                  ? 'Saving…'
                  : hasPassword
                    ? 'Change password'
                    : 'Set password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              {hasPassword ? 'Change password' : 'Set a password'}
            </Button>

            {hasPassword ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleSendReset}
                disabled={isSendingReset}
              >
                {isSendingReset ? 'Sending…' : 'Email me a reset link'}
              </Button>
            ) : null}
          </div>
        )}

        {notice ? (
          <p className="text-muted-foreground text-sm">{notice}</p>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
