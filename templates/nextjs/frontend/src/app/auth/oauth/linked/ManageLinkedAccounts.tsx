'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ProviderIcon from '@/app/auth/oauth/ProviderIcon';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { useRemoved } from '@/components/useRemoved';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { unlinkProvider } from './actions';
import { leavesAWayIn } from './wayIn';

export type LinkedProvider = {
  id: string;
  name: string;
  connectHref: string;
  link?: { id: string; since: string };
};

/**
 * A line per provider: Link account leaves for the provider and comes back to
 * the account page, Unlink stays here with the list read again under it.
 */
export default function ManageLinkedAccounts({
  providers: listed,
  email,
  links,
}: {
  providers: LinkedProvider[];
  email: string | undefined;
  links: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | undefined>();

  // Shown as not linked as soon as Unlink is pressed, rather than once the
  // refreshed page arrives (see `useRemoved`).
  const { removed, remove, restore } = useRemoved();
  const providers = listed.map((provider) =>
    provider.link && removed.has(provider.link.id)
      ? { ...provider, link: undefined }
      : provider,
  );
  const canUnlink = leavesAWayIn(email, links - removed.size);

  const handleUnlink = async (provider: LinkedProvider) => {
    if (!provider.link) {
      return;
    }

    const { id } = provider.link;
    setError(undefined);
    remove(id);
    try {
      const result = await unlinkProvider(id);
      if (result.error) {
        restore(id);
        setError(result.error);
        return;
      }

      toast(`${provider.name} unlinked`);
      router.refresh();
    } catch (err) {
      console.error('Error unlinking a provider:', err);
      restore(id);
      setError(NETWORK_ERROR);
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
                disabled={!canUnlink}
                onClick={() => void handleUnlink(provider)}
              >
                Unlink
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
        <DialogClose>Done</DialogClose>
      </DialogFooter>
    </div>
  );
}
