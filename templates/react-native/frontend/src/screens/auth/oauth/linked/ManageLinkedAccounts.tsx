import type { SignInProvider } from '@nhost/nhost-js/auth';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { useRemoved } from '@/components/useRemoved';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import {
  linkProvider,
  unlinkProvider,
} from '@/screens/auth/oauth/linked/actions';
import { leavesAWayIn } from '@/screens/auth/oauth/linked/wayIn';
import ProviderIcon from '@/screens/auth/oauth/ProviderIcon';
import { colors, fontSize, radius } from '@/theme';

export type LinkedProvider = {
  id: SignInProvider;
  name: string;
  link?: { id: string; since: string };
};

/**
 * A line per provider: Link account opens the provider in the in-app browser
 * and reads the list again once it is linked, Unlink stays here with the list
 * read again under it.
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
  const refresh = useRefresh();
  const toast = useToast();
  const [error, setError] = useState<string | undefined>();
  const [linking, setLinking] = useState(false);

  // Shown as not linked as soon as Unlink is pressed, rather than once the
  // refreshed screen arrives (see `useRemoved`).
  const { removed, remove, restore } = useRemoved();
  const providers = listed.map((provider) =>
    provider.link && removed.has(provider.link.id)
      ? { ...provider, link: undefined }
      : provider,
  );
  // Only the removals the list still shows: once it is read again, `links`
  // already leaves them out.
  const pending = listed.filter(
    ({ link }) => link && removed.has(link.id),
  ).length;
  const canUnlink = leavesAWayIn(email, links - pending);

  const handleLink = async (provider: LinkedProvider) => {
    if (linking) {
      return;
    }
    setError(undefined);
    setLinking(true);
    try {
      const result = await linkProvider(provider.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.success) {
        toast(`${provider.name} linked`);
        refresh();
      }
    } finally {
      setLinking(false);
    }
  };

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
      refresh();
    } catch (err) {
      console.error('Error unlinking a provider:', err);
      restore(id);
      setError(NETWORK_ERROR);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.list}>
        {providers.map((provider, index) => (
          <View
            key={provider.id}
            style={[styles.row, index > 0 && styles.rowLine]}
          >
            <ProviderIcon id={provider.id} />
            <View style={styles.name}>
              <Text style={styles.nameText}>{provider.name}</Text>
              <Text style={styles.muted} numberOfLines={1}>
                {provider.link ? `Linked ${provider.link.since}` : 'Not linked'}
              </Text>
            </View>
            {provider.link ? (
              <Button
                title="Unlink"
                variant="ghost"
                size="sm"
                labelStyle={styles.destructive}
                disabled={!canUnlink || linking}
                onPress={() => void handleUnlink(provider)}
              />
            ) : (
              <Button
                title="Link account"
                variant="outline"
                size="sm"
                disabled={linking}
                onPress={() => void handleLink(provider)}
              />
            )}
          </View>
        ))}
      </View>

      {email ? (
        <Text style={styles.muted}>
          Unlinking doesn't block a provider whose verified email is {email}.
          Signing in with it links it again.
        </Text>
      ) : null}

      {canUnlink ? null : (
        <Text style={styles.muted}>
          This account has no email address, so its only linked account stays
          until another is added.
        </Text>
      )}

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <DialogFooter>
        <DialogClose title="Done" disabled={linking} />
      </DialogFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
  },
  rowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  nameText: {
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  muted: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
  },
  destructive: {
    color: colors.destructive,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
