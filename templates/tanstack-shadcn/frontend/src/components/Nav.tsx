import { Link } from '@tanstack/react-router';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/nhost/auth-provider';

export default function Nav() {
  const { session } = useAuth();

  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link to="/" className="font-semibold">
          Nhost + TanStack Start
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Home</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/protected">Protected</Link>
          </Button>

          {session ? (
            <SignOutButton />
          ) : (
            <Button asChild size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
