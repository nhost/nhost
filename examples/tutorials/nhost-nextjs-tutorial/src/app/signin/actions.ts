"use server";

import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { createNhostClient } from "../../lib/nhost/server";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return {
      error: "Email and password are required",
    };
  }

  try {
    const nhost = await createNhostClient();

    const response = await nhost.auth.signInEmailPassword({
      email,
      password,
    });

    if (response.body?.session) {
      return { redirect: "/profile" };
    } else {
      return {
        error: "Failed to sign in. Please check your credentials.",
      };
    }
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `An error occurred during sign in: ${error.message}`,
    };
  }
}
