"use server";

import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { createNhostClient } from "../../lib/nhost/server";

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  if (!email || !password || !displayName) {
    return {
      error: "All fields are required",
    };
  }

  try {
    const nhost = await createNhostClient();

    const response = await nhost.auth.signUpEmailPassword({
      email,
      password,
      options: {
        displayName,
        // Set the redirect URL for email verification
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify`,
      },
    });

    if (response.body?.session) {
      // Successfully signed up and automatically signed in
      return { redirect: "/profile" };
    } else {
      // Verification email sent
      return {
        redirect: `/signup?verify=success&email=${encodeURIComponent(email)}`
      };
    }
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `An error occurred during sign up: ${error.message}`,
    };
  }
}
