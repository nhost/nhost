'use client';

import { type FormEvent, useId, useState } from 'react';
import { changePassword } from '@/app/account/actions';
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

export default function ChangePasswordForm() {
  const passwordId = useId();
  const confirmId = useId();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setDone(false);

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setIsPending(true);
    try {
      const result = await changePassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }

      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      console.error('Error changing the password:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Sets a new password. The current one is not asked for: being signed in
          is what authorises the change.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor={passwordId}>New password</Label>
            <Input
              id={passwordId}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={confirmId}>Confirm new password</Label>
            <Input
              id={confirmId}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={isPending}
            />
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          {done ? (
            <p role="status" className="text-muted-foreground text-sm">
              Password changed.
            </p>
          ) : null}

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
