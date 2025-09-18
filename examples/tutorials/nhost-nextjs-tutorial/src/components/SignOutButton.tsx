"use client";

import { useRouter } from "next/navigation";
import { signOut } from "../lib/nhost/actions";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
      router.refresh(); // Refresh to update server components
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="nav-link nav-button"
    >
      Sign Out
    </button>
  );
}
