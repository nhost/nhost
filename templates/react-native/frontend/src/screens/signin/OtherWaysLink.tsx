import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { buttons, methods } from '@/screens/signin/methods';
import { colors, fontSize } from '@/theme';

/**
 * Sends the visitor back to the list of sign-in methods, when there is a list
 * worth going back to.
 */
export default function OtherWaysLink({ query }: { query: string }) {
  if (methods.length + buttons.length < 2) {
    return null;
  }

  return (
    <Link href={`/signin${query}`} asChild>
      <Text role="link" style={styles.link}>
        Other ways to sign in
      </Text>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
});
