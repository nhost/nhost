import { StyleSheet, Text, View } from 'react-native';
import { first, type SearchParam } from '@/lib/utils';
import { colors, fontSize, monospace, radius } from '@/theme';

// The codes the auth service can redirect back with, from its
// `sendRedirectError` callers.
const messages = new Map([
  [
    'disabled-endpoint',
    'This sign-in provider is not turned on. If this is your app, enable it in nhost/nhost.toml.',
  ],
  ['disabled-user', 'Your account is disabled.'],
  [
    'internal-server-error',
    'Something went wrong on our side. Please try again.',
  ],
  ['invalid-email-password', 'We could not sign you in with that account.'],
  [
    'invalid-request',
    'Something was wrong with the sign-in request. Please start again.',
  ],
  [
    'invalid-state',
    'Your sign-in took too long or was interrupted. Please start again.',
  ],
  ['invalid-ticket', 'This link is invalid or has expired. Request a new one.'],
  [
    'oauth-profile-fetch-failed',
    'We could not read your profile from the provider. Please try again.',
  ],
  [
    'oauth-provider-error',
    'The provider did not complete your sign-in. Please try again.',
  ],
  // The missing x is the spelling the auth service sends.
  [
    'oauth-token-echange-failed',
    'We could not finish signing you in with the provider. Please try again.',
  ],
  [
    'provider-account-already-linked',
    'This provider account is already linked to another user.',
  ],
  [
    'redirectTo-not-allowed',
    'This app is not on the list of addresses the sign-in may return to.',
  ],
  ['signup-disabled', 'New sign-ups are turned off.'],
  ['unverified-user', 'Verify your email address first, then try again.'],
  ['user-already-exists', 'An account with this email address already exists.'],
]);

/** Says why an auth redirect failed. */
export default function AuthErrorNotice({ error }: { error: SearchParam }) {
  const code = first(error);
  if (!code) {
    return null;
  }

  const message = messages.get(code);

  return (
    <View accessible role="alert" style={styles.notice}>
      <Text style={styles.message}>
        {message ? (
          <>
            {message} <Text style={styles.code}>({code})</Text>
          </>
        ) : (
          'Sign-in failed.'
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.destructiveBackground,
  },
  message: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
  code: {
    fontFamily: monospace,
    fontSize: fontSize.xs,
  },
});
