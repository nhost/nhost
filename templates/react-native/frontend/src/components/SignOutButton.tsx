import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/components/useSignOut';
import { colors, fontSize } from '@/theme';

export default function SignOutButton() {
  const { error, isSigningOut, handleSignOut } = useSignOut();

  return (
    <View style={styles.column}>
      <Button
        title={isSigningOut ? 'Signing out…' : 'Sign out'}
        variant="outline"
        size="sm"
        disabled={isSigningOut}
        onPress={handleSignOut}
      />
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'flex-end',
    gap: 4,
  },
  error: {
    maxWidth: 220,
    color: colors.destructive,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
});
