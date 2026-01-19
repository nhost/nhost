import { createNhostClient } from '../lib/nhost/server';
import ActiveLink from './ActiveLink';
import SignOutButton from './SignOutButton';

export default async function Navigation() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="flex items-center">
          <span className="navbar-brand">Nhost Demo</span>
          <div className="navbar-links">
            {session ? (
              <>
                <ActiveLink href="/profile" className="nav-link">
                  Profile
                </ActiveLink>
                <ActiveLink href="/upload" className="nav-link">
                  Upload
                </ActiveLink>
              </>
            ) : (
              <>
                <ActiveLink href="/signin" className="nav-link">
                  Sign In
                </ActiveLink>
                <ActiveLink href="/signup" className="nav-link">
                  Sign Up
                </ActiveLink>
              </>
            )}
          </div>
        </div>

        {session && <SignOutButton />}
      </div>
    </nav>
  );
}
