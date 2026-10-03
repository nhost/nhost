'use client';

import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { setProfilePublished } from '@/app/profile/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * The switch that decides whether `/u/<id>` exists at all.
 *
 * On by default, so a scaffolded project has a working public page from the
 * first sign-in rather than a feature that does nothing until somebody finds
 * this card. Turning it off is a complete retraction: the `public` role stops
 * seeing the account, its shared items and their photos all at once.
 *
 * The control is worded as the thing it does rather than the state it leaves
 * behind - "Disable public profile", on when disabled - so the switch reads as
 * an action taken rather than a permission granted. That inverts the usual
 * "on means enabled", so `checked` is the negation of `published` in exactly
 * one place, here, and the stored value stays an opt-out end to end.
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
  const disableId = useId();
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [, startTransition] = useTransition();

  // What the card draws, which is the server's answer until this browser
  // changes it. Waiting for the round trip meant the switch stayed where it
  // was, then the switch moved, then the link appeared or vanished - three
  // paints for one click, which is the shifting about that looked broken.
  // Moving both at once on the click makes it a single change.
  const [shown, setShown] = useState(published);
  useEffect(() => setShown(published), [published]);

  const url = `${origin}/u/${userId}`;

  const handleToggle = async (disabled: boolean): Promise<void> => {
    setError(undefined);
    setIsSaving(true);
    setShown(!disabled);
    try {
      const result = await setProfilePublished(!disabled);
      if (result.error) {
        setShown(published);
        setError(result.error);
        return;
      }

      // In a transition so React keeps this card on screen while the server
      // components re-render, rather than tearing it down to a loading state
      // and back for a change that has already visibly happened.
      startTransition(() => router.refresh());
    } catch (err) {
      setShown(published);
      console.error('Could not update the public profile setting:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSaving(false);
    }
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
          shared.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {shown ? (
          /* The link comes first because it is what this card is for. Turning
             the page off is the rarer thing, so it sits underneath rather than
             standing between the description and the address it describes.

             No border and no field background: this is the address, not
             somewhere to type one. Dressed as an input it invited a click and
             a cursor, and then did nothing. */
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
              {url}
            </code>

            <Button
              type="button"
              variant="ghost"
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
            <Button asChild variant="ghost" size="icon" title="Open the page">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                <span className="sr-only">Open your public page</span>
              </a>
            </Button>
          </div>
        ) : null}

        {/* The switch sits at the end of its own row rather than beside the
            label, which is where a settings row puts it and what keeps the
            label the thing you read first. The rule above it only exists to
            separate it from the link; with the page off there is no link, and
            a rule directly under the description would divide nothing. */}
        <div
          className={cn(
            'flex items-center justify-between gap-4',
            shown && 'border-t pt-4',
          )}
        >
          <Label htmlFor={disableId} className="font-normal">
            Disable public profile
          </Label>
          <Switch
            id={disableId}
            checked={!shown}
            onCheckedChange={(disabled) => void handleToggle(disabled)}
            disabled={isSaving}
          />
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
