import CenteredLayout from '@/components/CenteredLayout';
import { useSession } from '@/lib/nhost/AuthProvider';

export default function AccountPage() {
  const email = useSession()?.user?.email;

  return (
    <CenteredLayout>
      <p className="text-muted-foreground text-sm">Signed in as {email}.</p>
    </CenteredLayout>
  );
}
