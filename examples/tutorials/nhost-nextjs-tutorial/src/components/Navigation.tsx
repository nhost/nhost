import Link from "next/link";
import { createNhostClient } from "../lib/nhost/server";
import SignOutButton from "./SignOutButton";

export default async function Navigation() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-content">
          <Link href="/" className="logo">
            Nhost Next.js Demo
          </Link>

          <div className="nav-links">
            <Link href="/" className="nav-link">
              Home
            </Link>

            {session ? (
              <>
                <Link href="/profile" className="nav-link">
                  Profile
                </Link>
                <SignOutButton />
              </>
            ) : (
              <>
                Placeholder for signin/signup links
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
