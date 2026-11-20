import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Dialog from '@/components/Dialog';
import { SettingsItem } from '@/components/Setting';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { useRemoved } from '@/components/useRemoved';
import { useSignOut } from '@/components/useSignOut';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { type AccountSession, signOutSession } from '@/screens/account/actions';
import ConfirmAction from '@/screens/account/ConfirmAction';
import { formatSessionTime } from '@/screens/account/sessions';
import { colors, fontSize, monospace } from '@/theme';

/** One line per session on the account, each with a way to sign it out. */
export default function SessionList({
  sessions: listed,
}: {
  sessions: AccountSession[];
}) {
  const refresh = useRefresh();
  const toast = useToast();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<AccountSession | undefined>();
  const here = useSignOut();

  // Another session leaves the list as soon as it is signed out, rather than
  // once the list loads again (see `useRemoved`), and comes back only if the
  // backend refused.
  const { removed, remove, restore } = useRemoved();
  const sessions = listed.filter((session) => !removed.has(session.id));

  // The dialog closes on confirming: this session's line then says it is
  // signing out until the home screen arrives, and another's leaves the list.
  const handleConfirm = async (session: AccountSession): Promise<undefined> => {
    setConfirming(undefined);
    if (session.current) {
      here.handleSignOut();
    } else {
      void handleSignOut(session);
    }
    return undefined;
  };

  const handleSignOut = async (session: AccountSession): Promise<void> => {
    setError(undefined);
    remove(session.id);
    try {
      const result = await signOutSession(session.id);
      if (result.error) {
        restore(session.id);
        setError(result.error);
        return;
      }

      toast('Session signed out');
      refresh();
    } catch (err) {
      console.error('Error signing out a session:', err);
      restore(session.id);
      setError(NETWORK_ERROR);
    }
  };

  return (
    <>
      {sessions.map((session) => (
        <SettingsItem key={session.id} style={styles.row}>
          {/* The time on a line of its own: a phone is too narrow for the
              whole line on one. */}
          <View style={styles.details}>
            <View style={styles.tags}>
              {/* Enough of the id to tell two sessions apart. */}
              <Text style={styles.id}>{session.id.slice(0, 5)}</Text>
              {session.current ? (
                <Text style={styles.current}>This session</Text>
              ) : null}
            </View>
            <Text style={styles.time} numberOfLines={1}>
              Signed in {formatSessionTime(session.createdAt)}
            </Text>
          </View>
          <Button
            title={
              session.current && here.isSigningOut ? 'Signing out…' : 'Sign out'
            }
            variant="outline"
            size="sm"
            disabled={here.isSigningOut}
            onPress={() => setConfirming(session)}
          />
        </SettingsItem>
      ))}
      {(error ?? here.error) ? (
        <SettingsItem style={styles.alert}>
          <Text role="alert" style={styles.error}>
            {error ?? here.error}
          </Text>
        </SettingsItem>
      ) : null}
      {confirming ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setConfirming(undefined);
            }
          }}
          title={
            confirming.current
              ? 'Sign out of this device?'
              : 'Sign out this session?'
          }
          description={
            confirming.current
              ? "You'll go back to the home screen and need to sign in again here."
              : `Session ${confirming.id.slice(0, 5)} will need to sign in again.`
          }
        >
          <ConfirmAction
            confirm="Sign out"
            pending="Signing out…"
            destructive
            onConfirm={() => handleConfirm(confirming)}
          />
        </Dialog>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  id: {
    overflow: 'hidden',
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    color: colors.mutedForeground,
    fontFamily: monospace,
    fontSize: 11,
  },
  time: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
  },
  current: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    color: colors.foreground,
    fontSize: fontSize.xs,
  },
  alert: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
