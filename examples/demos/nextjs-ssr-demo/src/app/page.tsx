import { redirect } from "next/navigation";
import { createNhostClient } from "./lib/nhost/server";

export default async function Home() {
  // Check if user is already authenticated
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  // Redirect based on authentication status
  if (session) {
    redirect("/profile");
  }

  redirect("/signin");
}
