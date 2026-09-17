'use client';

import { type FormEvent, useId, useState } from 'react';
import { changePassword } from '@/app/profile/actions';
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

export function PasswordCard() {
  const passwordId = useId();

  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    setIsSaving(true);

    const result = await changePassword(password);
    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setPassword('');
    setSaved(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Signing in with a code never sets one. Set a password here and the
          password tab on the sign-in page works too.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
            {isSaving ? 'Saving…' : 'Set password'}
          </Button>
        </form>

        <p className="text-muted-foreground text-sm">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>

        {saved ? (
          <p className="text-muted-foreground text-sm">Password updated.</p>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
