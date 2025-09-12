"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function SignOutButton() {
  const { session, nhost } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      if (session) {
        await nhost.auth.signOut({
          refreshToken: session.refreshToken,
        });
      }
      router.push("/");
    } catch (err: any) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="sign-out-btn"
    >
      Sign Out
    </button>
  );
}
