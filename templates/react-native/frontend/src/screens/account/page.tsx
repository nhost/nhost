import type { User } from '@nhost/nhost-js/auth';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Code from '@/components/Code';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { goTo } from '@/lib/goTo';
import { getVerifiedUser, nhost } from '@/lib/nhost/client';
import { useLoad } from '@/lib/useLoad';
import ProfileSummary from '@/screens/account/ProfileSummary';
import SignInSettings from '@/screens/account/SignInSettings';
import { signInHref } from '@/screens/signin/destination';
import { colors, fontSize } from '@/theme';

// A stored session the auth service turned down was revoked or never real.
// Cleared first, or the sign-in screen would send the user straight back.
function SignInAgain() {
  // StrictMode runs the effect twice, and the second `goTo` would dismiss a
  // stack the first has already emptied.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) {
      return;
    }
    done.current = true;
    nhost.sessionStorage.remove();
    goTo(signInHref('/account'));
  }, []);

  return null;
}

/** The signed-in user's account. */
export default function Account() {
  // The guard only reads the stored session, which proves nothing about it.
  const verified = useLoad(getVerifiedUser);
  const refresh = useRefresh();

  // A reload that comes back empty keeps the account on screen: whatever ended
  // the session navigates away on its own.
  const [last, setLast] = useState<User | null>(null);
  if (verified?.user && verified.user !== last) {
    setLast(verified.user);
  }
  const user = verified?.user ?? last;

  if (!user) {
    if (!verified || verified.user) {
      return null;
    }

    // Anything but a refusal says nothing about the session, and sending it to
    // the sign-in screen, which sends a session here, would loop until it
    // ends.
    if (verified.reason === 'unavailable') {
      return (
        <View style={styles.unavailable}>
          <Text role="alert" style={styles.error}>
            Could not load your account.
          </Text>
          <Button
            title="Try again"
            variant="outline"
            size="sm"
            onPress={refresh}
          />
        </View>
      );
    }

    return <SignInAgain />;
  }

  return (
    <View style={styles.page}>
      <ProfileSummary user={user} />
      <SignInSettings user={user} />

      <Text style={styles.hint}>
        Edit this screen in <Code>src/screens/account/</Code>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: 16,
  },
  unavailable: {
    alignItems: 'center',
    gap: 12,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
