import { useApolloClient } from '@apollo/client';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { useAuth } from '@/providers/Auth';

export default function AccountMenuSignOut() {
  const apolloClient = useApolloClient();
  const { signout } = useAuth();

  async function handleSignOut() {
    await apolloClient.clearStore();
    await signout();
  }

  return (
    <div className="p-2">
      <Button variant="menu-destructive" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
