'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useRef, useState } from 'react';
import { uploadAvatar } from '@/app/account/actions';
import {
  AVATAR_TOO_LARGE,
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
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

export default function AvatarForm({ avatarUrl }: { avatarUrl: string }) {
  const router = useRouter();
  const fileId = useId();
  const form = useRef<HTMLFormElement>(null);

  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const file = formData.get('avatar');
    if (file instanceof File && file.size > MAX_AVATAR_BYTES) {
      setError(AVATAR_TOO_LARGE);
      return;
    }

    setIsPending(true);
    try {
      const result = await uploadAvatar(formData);
      if (result.error) {
        setError(result.error);
        return;
      }

      form.current?.reset();
      // The summary above reads the URL from the auth service, so the page is
      // re-rendered rather than patched here.
      router.refresh();
    } catch (err) {
      console.error('Error uploading the avatar:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <CardDescription>
          An image for this account. It is stored privately and served to you
          through this app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: this app's own route handler or the gravatar a fresh account starts with, neither an origin next/image knows
          <img
            src={avatarUrl}
            alt=""
            width={64}
            height={64}
            className="size-16 rounded-full"
          />
        ) : null}

        <form
          ref={form}
          className="flex flex-col gap-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={fileId}>New image</Label>
            <Input
              id={fileId}
              name="avatar"
              type="file"
              accept={AVATAR_TYPES.join(',')}
              required
              disabled={isPending}
            />
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
