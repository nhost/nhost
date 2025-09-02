"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNhostClient } from "../nhost/server";

/**
 * Revalidates the specified path after authentication state changes
 * This ensures that server components re-render with the new auth state
 */
// biome-ignore lint/suspicious/useAwait: this needs to be async
export async function revalidateAfterAuthChange(path = "/") {
  // Revalidate the specified path to refresh server components
  revalidatePath(path);
  return { success: true };
}

/**
 * Signs out the current user using the Nhost client
 * and redirects them to the homepage
 */
export async function signOut() {
  // Get the server Nhost client
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (session) {
    // Sign out with the refresh token
    await nhost.auth.signOut({
      refreshToken: session.refreshToken,
    });
  }

  // Revalidate all paths to ensure server components re-render
  revalidatePath("/");

  // Redirect to the homepage
  redirect("/");
}
