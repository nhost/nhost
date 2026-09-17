'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useRef, useState } from 'react';
import { uploadAvatar } from '@/app/profile/actions';
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

// Mirrors the server action's cap; the early check just saves an upload that
// would be rejected anyway.
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export function AvatarCard({
  avatarUrl,
  displayName,
}: {
  avatarUrl?: string | null;
  displayName?: string | null;
}) {
  const router = useRouter();
  const fileId = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError('Choose an image first.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('The image is too large. Keep it under 4 MB.');
      return;
    }

    const formData = new FormData();
    formData.set('avatar', file);

    setIsUploading(true);
    const result = await uploadAvatar(formData);
    setIsUploading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (fileInput.current) {
      fileInput.current.value = '';
    }
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <CardDescription>
          The photo goes to the <code>avatar</code> function, which resizes it
          to 512×512 and stores it in the <code>avatars</code> bucket.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: the backend already sized the file, and the storage host varies per environment so next/image would need remotePatterns config
            <img
              src={avatarUrl}
              alt={displayName ? `Avatar of ${displayName}` : 'Your avatar'}
              className="h-16 w-16 rounded-full border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted text-2xl">
              {(displayName ?? '?').charAt(0).toUpperCase()}
            </div>
          )}
          <form className="flex flex-1 items-end gap-2" onSubmit={handleUpload}>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={fileId}>New photo</Label>
              <Input
                id={fileId}
                ref={fileInput}
                type="file"
                accept="image/*"
                disabled={isUploading}
              />
            </div>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading…' : 'Upload'}
            </Button>
          </form>
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
