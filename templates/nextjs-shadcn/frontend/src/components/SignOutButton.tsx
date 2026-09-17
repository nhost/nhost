'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/nhost/actions';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
