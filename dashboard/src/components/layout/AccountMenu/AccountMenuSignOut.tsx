import { useApolloClient } from '@apollo/client';
import { LogOut } from 'lucide-react';
import { MenuRow } from '@/components/ui/v3/menu-row';
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
      <MenuRow variant="destructive" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </MenuRow>
    </div>
  );
}
