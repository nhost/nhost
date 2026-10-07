import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/nhost/AuthProvider';

export default function SignOutButton() {
  const { nhost } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState<string | undefined>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async (): Promise<void> => {
    setError(undefined);
    setIsSigningOut(true);
    try {
      // Clears the stored session, which the provider is subscribed to, so
      // every tab drops to signed out without this having to tell them.
      await nhost.auth.signOut({
        refreshToken: nhost.getUserSession()?.refreshToken ?? '',
      });

      void navigate('/');
    } catch (err) {
      console.error('Error signing out:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
