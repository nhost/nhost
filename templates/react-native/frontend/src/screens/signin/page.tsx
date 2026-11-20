import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import CenteredLayout from '@/components/CenteredLayout';
import LastUsedBadge from '@/components/LastUsedBadge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SearchParam } from '@/lib/utils';
import { signInDestination } from '@/screens/signin/destination';
import { type Intent, signInIntent } from '@/screens/signin/intent';
import { lastUsedSignIn } from '@/screens/signin/lastUsed';
import { buttons, methods } from '@/screens/signin/methods';
import { signInQuery } from '@/screens/signin/query';
import { colors, fontSize, radius } from '@/theme';

// What the screen says depends on why the visitor is here.
const copy: Record<
  Intent,
  {
    title: string;
    description: string;
    switchTo: { intent: Intent; prompt: string; label: string };
  }
> = {
  'sign-up': {
    title: 'Create an account',
    description: 'Choose how you want to sign up.',
    switchTo: {
      intent: 'sign-in',
      prompt: 'Already have an account?',
      label: 'Sign in',
    },
  },
  'sign-in': {
    title: 'Sign in',
    description: 'Choose how you want to sign in.',
    switchTo: {
      intent: 'sign-up',
      prompt: 'New here?',
      label: 'Create an account',
    },
  },
};

/** Lists the ways to sign in. */
export default function SignIn() {
  const params = useLocalSearchParams<{
    next?: SearchParam;
    intent?: SearchParam;
  }>();
  const destination = signInDestination(params.next);
  const chosen = signInIntent(params.intent);
  const query = signInQuery(destination, chosen);
  const { switchTo } = copy[chosen];
  const lastUsed = lastUsedSignIn();

  return (
    <CenteredLayout>
      <Card style={styles.card}>
        {/* Everything is centred, the links included, to match the provider
            buttons, which centre their own label. */}
        <CardHeader>
          <CardTitle style={styles.centred}>{copy[chosen].title}</CardTitle>
          <CardDescription style={styles.centred}>
            {copy[chosen].description}
          </CardDescription>
        </CardHeader>
        <CardContent style={styles.content}>
          {methods.map((method) => (
            <Link key={method.href} href={`${method.href}${query}`} asChild>
              <Pressable role="link" style={styles.method}>
                {method.href === lastUsed ? <LastUsedBadge /> : null}
                <Text style={styles.methodTitle}>{method.title}</Text>
                <Text style={styles.methodDescription}>
                  {method.description}
                </Text>
              </Pressable>
            </Link>
          ))}
          {buttons.length > 0 ? (
            <>
              {/* Set apart from the links: these leave for the provider
                  straight away, where a link opens a screen of the app's. */}
              {methods.length > 0 ? (
                <View style={styles.divider}>
                  <View style={styles.rule} />
                  <Text style={styles.or}>or</Text>
                  <View style={styles.rule} />
                </View>
              ) : null}
              {buttons.map((Buttons) => (
                <Buttons
                  key={Buttons.name}
                  destination={destination}
                  lastUsed={lastUsed}
                />
              ))}
            </>
          ) : null}
          {/* A clear gap, not a nudge: this is the way out of the list, not
              another item in it. */}
          <Text style={styles.switch}>
            {`${switchTo.prompt} `}
            <Link
              href={`/signin${signInQuery(destination, switchTo.intent)}`}
              asChild
            >
              <Text role="link" style={styles.switchLink}>
                {switchTo.label}
              </Text>
            </Link>
          </Text>
        </CardContent>
      </Card>
    </CenteredLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
  },
  centred: {
    textAlign: 'center',
  },
  content: {
    gap: 12,
    paddingHorizontal: 40,
  },
  method: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodTitle: {
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  methodDescription: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  or: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
  },
  switch: {
    paddingTop: 24,
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  switchLink: {
    color: colors.foreground,
  },
});
