import Link from "next/link";
import { createNhostClient } from "../lib/nhost/server";
import SignOutButton from "./SignOutButton";

export default async function Navigation() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link href="/" className="nav-logo">
          Nhost Next.js Demo
        </Link>

        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>

          {session ? (
            <>
              <Link href="/todos" className="nav-link">
                Todos
              </Link>
              <Link href="/files" className="nav-link">
                Files
              </Link>
              <Link href="/profile" className="nav-link">
                Profile
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/signin" className="nav-link">
                Sign In
              </Link>
              <Link href="/signup" className="nav-link">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
