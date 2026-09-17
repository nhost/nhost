'use client';

import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { setProfilePublished } from '@/app/profile/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/**
 * The switch that decides whether `/u/<id>` exists at all.
 *
 * Marking an item shared puts it on the list; this is what makes the list
 * readable. Both have to be on, so nothing becomes public as a side effect of
 * one click in one place.
 */
export function PublicProfileCard({
  userId,
  origin,
  published,
}: {
  userId: string;
  origin: string;
  published: boolean;
}) {
  const router = useRouter();
  const publishId = useId();
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const url = `${origin}/u/${userId}`;

  const handleToggle = async (next: boolean): Promise<void> => {
    setError(undefined);
    setIsSaving(true);

    const result = await setProfilePublished(next);
    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the link. Select it and copy it by hand.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4" aria-hidden />
          Public profile
        </CardTitle>
        <CardDescription>
          Anyone with the link sees your name, your photo, and the items you
          shared. Nothing else.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={publishId}
            checked={published}
            onCheckedChange={(checked) => handleToggle(checked === true)}
            disabled={isSaving}
          />
          <Label htmlFor={publishId} className="font-normal">
            Publish my profile
          </Label>
        </div>

        {published ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">
              {url}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="Copy the link"
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              <span className="sr-only">
                {copied ? 'Link copied' : 'Copy the link'}
              </span>
            </Button>

            {/* A new tab on purpose: this is the page as a stranger gets it,
                and leaving the profile behind to check would mean finding the
                way back. */}
            <Button asChild variant="outline" size="icon" title="Open the page">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                <span className="sr-only">Open your public page</span>
              </a>
            </Button>
          </div>
        ) : null}

        {/* Publishing gives the page an address; it does not put anything on
            it. Without this, the obvious next move after copying the link is
            to open it, find it empty, and have nowhere to go from there. */}
        {published ? (
          <p className="text-muted-foreground text-sm">
            Only the items you share appear on it.{' '}
            <Link href="/protected" className="underline underline-offset-4">
              Choose what to show
            </Link>
            .
          </p>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
