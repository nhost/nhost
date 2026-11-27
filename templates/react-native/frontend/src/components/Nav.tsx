import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NavAccount from '@/components/NavAccount';
import NhostLogo from '@/components/NhostLogo';
import SignOutButton from '@/components/SignOutButton';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/nhost/AuthProvider';
import { DEFAULT_DESTINATION } from '@/screens/signin/destination';
import { methods } from '@/screens/signin/methods';
import { signInQuery } from '@/screens/signin/query';
import { colors, fontSize, inset } from '@/theme';

const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;

const signedOutPaths = methods.flatMap((method) => method.signedOutPaths ?? []);

/** The header of every screen. */
export default function Nav() {
  const { top } = useSafeAreaInsets();
  const user = useSession()?.user;

  return (
    <View style={[styles.nav, { paddingTop: top + 12 }]}>
      <Link href="/" asChild>
        <Pressable role="link" style={styles.home}>
          <NhostLogo size={20} />
          <Text style={styles.brand}>Nhost</Text>
        </Pressable>
      </Link>

      <NavAccount
        signedOutPaths={signedOutPaths}
        signedIn={
          user ? (
            <View style={styles.actions}>
              <SignOutButton />
              <Link href="/account" asChild>
                <Pressable role="link" aria-label="Your account">
                  <UserAvatar
                    avatarUrl={user.avatarUrl}
                    displayName={user.displayName}
                    width={64}
                    size={32}
                  />
                </Pressable>
              </Link>
            </View>
          ) : null
        }
        signedOut={
          <View style={styles.actions}>
            <Link href={signInLink} asChild>
              <Button title="Sign in" variant="outline" size="sm" role="link" />
            </Link>
            <Link href={signUpLink} asChild>
              <Button title="Sign up" size="sm" role="link" />
            </Link>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: inset.screen,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  home: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    color: colors.foreground,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
});
