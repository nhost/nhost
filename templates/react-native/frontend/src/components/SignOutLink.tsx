import { StyleSheet, Text } from 'react-native';
import { useSignOut } from '@/components/useSignOut';
import { colors } from '@/theme';

/** Sign out as a link in running text. */
export default function SignOutLink({ children }: { children: string }) {
  const { error, isSigningOut, handleSignOut } = useSignOut();

  return (
    <>
      <Text
        role="button"
        aria-disabled={isSigningOut}
        disabled={isSigningOut}
        onPress={handleSignOut}
        style={[styles.link, isSigningOut && styles.disabled]}
      >
        {children}
      </Text>
      {error ? (
        <Text role="alert" style={styles.error}>
          {` (${error})`}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.foreground,
    textDecorationLine: 'underline',
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: colors.destructive,
  },
});
