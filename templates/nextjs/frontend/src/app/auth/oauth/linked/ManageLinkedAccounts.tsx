'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ProviderIcon from '@/app/auth/oauth/ProviderIcon';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { unlinkProvider } from './actions';

export type LinkedProvider = {
  id: string;
  name: string;
  connectHref: string;
  link?: { id: string; since: string };
};

const NETWORK_ERROR = 'The request did not reach the server. Try again.';

/**
 * A line per provider: Link account leaves for the provider and comes back to the
 * account page, Unlink stays here with the list read again under it.
 *
 * `canUnlink` is false when the one link is the only way in, which the action
 * checks again: the button only saves a round trip to be told no.
 */
export default function ManageLinkedAccounts({
  providers,
  canUnlink,
}: {
  providers: LinkedProvider[];
  canUnlink: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handleUnlink = async (provider: LinkedProvider) => {
    if (!provider.link) {
      return;
    }

    setError(undefined);
    setPending(provider.id);
    try {
      const result = await unlinkProvider(provider.link.id);
      if (result.error) {
        setError(result.error);
        return;
      }

      toast(`${provider.name} unlinked`);
      router.refresh();
    } catch (err) {
      console.error('Error unlinking a provider:', err);
      setError(NETWORK_ERROR);
    } finally {
      setPending(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ul className="divide-y rounded-lg border">
        {providers.map((provider) => (
          <li
            key={provider.id}
            className="flex items-center gap-3 py-2 pr-2 pl-3 text-sm"
          >
            <span className="size-4 shrink-0 [&>svg]:size-4">
              <ProviderIcon id={provider.id} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{provider.name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {provider.link ? `Linked ${provider.link.since}` : 'Not linked'}
              </span>
            </span>
            {provider.link ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={Boolean(pending) || !canUnlink}
                onClick={() => void handleUnlink(provider)}
              >
                {pending === provider.id ? 'Unlinking…' : 'Unlink'}
              </Button>
            ) : (
              // A plain anchor: the route redirects to the provider, on
              // another origin, so there is nothing for Next to prefetch.
              <Button asChild variant="outline" size="sm">
                <a href={provider.connectHref}>Link account</a>
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canUnlink ? null : (
        <p className="text-muted-foreground text-xs">
          This account has no email address, so its only linked account stays
          until another is added.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose disabled={Boolean(pending)}>Done</DialogClose>
      </DialogFooter>
    </div>
  );
}
