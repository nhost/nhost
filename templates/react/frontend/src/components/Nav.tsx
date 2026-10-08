import { Link } from 'react-router';
import NhostLogo from '@/components/NhostLogo';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/nhost/AuthProvider';

export default function Nav() {
  return (
    <nav className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <NhostLogo className="size-5" />
          Nhost
        </Link>

        <Account />
      </div>
    </nav>
  );
}

function Account() {
  const { session, isLoading } = useAuth();

  // While a link token is redeemed it is not yet known who the visitor is, so
  // this offers nothing and only holds the bar's height.
  if (isLoading) {
    return <div className="h-8" />;
  }

  const user = session?.user;

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link to="/signin?intent=sign-in">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground text-sm">
        {user.email ?? user.id}
      </span>
      <SignOutButton />
    </div>
  );
}
