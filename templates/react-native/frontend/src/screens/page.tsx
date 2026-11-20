import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CenteredLayout from '@/components/CenteredLayout';
import Code from '@/components/Code';
import SignOutLink from '@/components/SignOutLink';
import StackTitle from '@/components/StackTitle';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/nhost/AuthProvider';
import { DEFAULT_DESTINATION } from '@/screens/signin/destination';
import { signInQuery } from '@/screens/signin/query';
import { colors, fontSize } from '@/theme';

const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.number}>
        <Text style={styles.numberText}>{n}</Text>
      </View>
      <View style={styles.stepBody}>
        <Text role="heading" style={styles.stepTitle}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

/** The starter's home screen: what this is and what to try first. */
export default function Home() {
  const user = useSession()?.user;

  return (
    <CenteredLayout>
      <View style={styles.page}>
        <View style={styles.header}>
          <StackTitle />
          <Text style={styles.tagline}>
            An auth starter for iOS and Android.
          </Text>
        </View>

        <View style={styles.section}>
          <Text role="heading" style={styles.sectionTitle}>
            Get started
          </Text>
          <View style={styles.steps}>
            <Step n={1} title="Create an account">
              {user ? (
                <Text style={styles.text}>
                  Done: you are signed in as {user.email ?? user.id}.
                </Text>
              ) : (
                <>
                  <Text style={styles.text}>
                    Sign up with any of the ways the sign-in screen offers.
                  </Text>
                  <View style={styles.actions}>
                    <Link href={signUpLink} asChild>
                      <Button title="Sign up" size="sm" role="link" />
                    </Link>
                  </View>
                </>
              )}
            </Step>

            <Step n={2} title="Explore your account">
              {/* The link is whichever half the visitor can do now: signed in,
                  signing out; signed out, the sign-in screen, which a session
                  would only send on to the account. */}
              {user ? (
                <Text style={styles.text}>
                  Edit your profile and how you sign in, then{' '}
                  <SignOutLink>sign out</SignOutLink> and try another way in.
                </Text>
              ) : (
                <Text style={styles.text}>
                  Edit your profile and how you sign in, then sign out and try{' '}
                  <Link href={signInLink} asChild>
                    <Text role="link" style={styles.link}>
                      another way in
                    </Text>
                  </Link>
                  .
                </Text>
              )}
              {user ? (
                <View style={styles.actions}>
                  <Link href="/account" asChild>
                    <Button
                      title="Go to your account"
                      size="sm"
                      variant="outline"
                      role="link"
                    />
                  </Link>
                </View>
              ) : null}
            </Step>

            <Step n={3} title="Make it yours">
              <Text style={styles.text}>
                Edit <Code>src/screens/page.tsx</Code>. Sign-in methods live in{' '}
                <Code>src/screens/auth/</Code>.
              </Text>
            </Step>
          </View>
        </View>
      </View>
    </CenteredLayout>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 48,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  tagline: {
    color: colors.mutedForeground,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  section: {
    gap: 24,
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  steps: {
    gap: 32,
  },
  step: {
    flexDirection: 'row',
    gap: 16,
  },
  number: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  numberText: {
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  stepBody: {
    flex: 1,
    gap: 8,
    paddingTop: 2,
  },
  stepTitle: {
    color: colors.foreground,
    fontSize: fontSize.base,
    fontWeight: '500',
  },
  text: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  link: {
    color: colors.foreground,
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    paddingTop: 4,
  },
});
