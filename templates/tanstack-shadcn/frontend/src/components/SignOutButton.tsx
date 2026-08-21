import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { nhost } from '@/lib/nhost/client';

export default function SignOutButton() {
  const navigate = useNavigate();

  const handleSignOut = async (): Promise<void> => {
    const session = nhost.getUserSession();

    if (session) {
      try {
        await nhost.auth.signOut({ refreshToken: session.refreshToken });
      } catch (err) {
        console.error('Error signing out:', err);
        return;
      }
    }

    await navigate({ to: '/' });
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
