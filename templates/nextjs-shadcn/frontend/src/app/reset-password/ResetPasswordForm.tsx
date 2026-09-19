'use client';

import { type FormEvent, useId, useState } from 'react';
import { changePassword } from '@/app/profile/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Matches auth.method.emailPassword.passwordMinLength in the backend config.
const MIN_PASSWORD_LENGTH = 9;

export function ResetPasswordForm() {
  const passwordId = useId();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setIsSaving(true);

    const result = await changePassword(password);

    if (result.error) {
      setIsSaving(false);
      setError(result.error);
      return;
    }

    // A full document load rather than a client navigation: changePassword
    // rotates the session cookie, so every Server Component here would
    // render against a stale session and the router's cached route trees
    // with it. It also drops /reset-password from history so Back can't
    // re-render it on the now-spent grant and show the expired-link error.
    window.location.replace('/profile');
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <form className="flex items-end gap-2" onSubmit={handleSave}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={passwordId}>New password</Label>
            <Input
              id={passwordId}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSaving}
            />
          </div>
          <Button
            type="submit"
            disabled={isSaving || password.length < MIN_PASSWORD_LENGTH}
          >
            {isSaving ? 'Saving…' : 'Save password'}
          </Button>
        </form>

        <p className="text-muted-foreground text-sm">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
