"use server";

import { redirect } from "next/navigation";
import { createNhostClient } from "./server";

export async function signOut() {
  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (session) {
      await nhost.auth.signOut({
        refreshToken: session.refreshToken,
      });
    }
  } catch (err) {
    console.error("Error signing out:", err);
    throw err;
  }

  redirect("/");
}
