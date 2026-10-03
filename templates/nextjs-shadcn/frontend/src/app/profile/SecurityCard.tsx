'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import {
  changePassword,
  sendOwnPasswordReset,
  sendReauthCode,
} from '@/app/profile/actions';
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

// Matches auth.method.emailPassword.passwordMinLength in the backend config.
const MIN_PASSWORD_LENGTH = 9;

export function SecurityCard({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const currentId = useId();
  const newId = useId();

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<ReactNode>(null);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const reset = (): void => {
    setEditing(false);
    setCurrent('');
    setPassword('');
    setError(undefined);
    setCodeSent(false);
  };

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

  const handleSave = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    setIsSaving(true);
    try {
      // Pass `current` unconditionally: gating it on `hasPassword` is the
      // bug that shipped and was rejected before.
      const result = await changePassword(password, current);
      if (result.error) {
        setError(result.error);
        return;
      }

      reset();
      setNotice(hasPassword ? 'Password changed.' : 'Password added.');
      router.refresh();
    } catch (err) {
      console.error('Could not change the password:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendReset = async (): Promise<void> => {
    setError(undefined);
    setNotice(undefined);
    setIsSendingReset(true);
    try {
      const result = await sendOwnPasswordReset();
      if (result.error) {
        setError(result.error);
        return;
      }

      setNotice(
        <>
          Reset link sent. Check your email.
          <MailboxHint />
        </>,
      );
    } catch (err) {
      console.error('Could not send the reset link:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          {hasPassword
            ? 'Sign in with this or an emailed code.'
            : 'Add one to sign in without a code.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
              <Label htmlFor={newId}>
                {hasPassword ? 'New password' : 'Password'}
              </Label>
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
                  isSaving || password.length < MIN_PASSWORD_LENGTH || !current
                }
              >
                {isSaving
                  ? 'Saving…'
                  : hasPassword
                    ? 'Change password'
                    : 'Add password'}
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
              {hasPassword ? 'Change password' : 'Add a password'}
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
