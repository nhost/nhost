"use server";

import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNhostClient } from "../../lib/nhost/server";

/**
 * Verifies MFA code for sign in
 */
export async function verifyMfa(formData: FormData): Promise<void> {
  const otp = formData.get("otp") as string;
  const ticket = formData.get("ticket") as string;

  // Validate inputs
  if (!otp || !ticket) {
    redirect("/signin/mfa?error=Verification+code+and+ticket+are+required");
  }

  try {
    // Get the server Nhost client
    const nhost = await createNhostClient();

    // Verify MFA code
    const response = await nhost.auth.verifySignInMfaTotp({
      ticket,
      otp,
    });

    // If we have a session, verification was successful
    if (response.body.session) {
      // Revalidate all paths to ensure server components re-render
      revalidatePath("/");

      // Redirect to profile page
      redirect("/profile");
    }

    // If we got here, something went wrong
    redirect(`/signin/mfa?ticket=${ticket}&error=Failed+to+verify+MFA+code`);
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    const errorMessage = `Failed to verify MFA code: ${error.message}`;
    redirect(
      `/signin/mfa?ticket=${ticket}&error=${encodeURIComponent(errorMessage)}`,
    );
  }
}
