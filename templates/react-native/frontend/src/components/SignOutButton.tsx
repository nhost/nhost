import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { useGo } from '@/lib/navigation';
import { useAuth } from '@/lib/nhost/AuthProvider';

export function SignOutButton() {
  const { nhost } = useAuth();
  const go = useGo();

  const [error, setError] = useState<string | undefined>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async (): Promise<void> => {
    setError(undefined);
    setIsSigningOut(true);
    try {
      // Clears the stored session, which the provider is subscribed to, so
      // every screen drops to signed out without this having to tell them.
      await nhost.auth.signOut({
        refreshToken: nhost.getUserSession()?.refreshToken ?? '',
      });

      go.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View className="gap-1">
      <Button
        variant="outline"
        isPending={isSigningOut}
        onPress={() => void handleSignOut()}
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </Button>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}
