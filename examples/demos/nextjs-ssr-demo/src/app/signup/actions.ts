"use server";

import type {
  CredentialCreationResponse,
  ErrorResponse,
} from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { revalidatePath } from "next/cache";
import { createNhostClient } from "../lib/nhost/server";

/**
 * Signs up a user with email and password
 */
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  // Validate inputs
  if (!email || !password || !displayName) {
    return { error: "All fields are required" };
  }

  try {
    // Get the server Nhost client
    const nhost = await createNhostClient();

    // Sign up with email and password
    const response = await nhost.auth.signUpEmailPassword({
      email,
      password,
      options: {
        displayName,
      },
    });

    // If we have a session, sign up was successful
    if (response.body.session) {
      // Revalidate all paths to ensure server components re-render
      revalidatePath("/");

      // Return redirect to profile page
      return { redirect: "/profile" };
    }

    // If we got here, something went wrong
    return { error: "Failed to sign up" };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to sign up: ${error.message}`,
    };
  }
}

/**
 * Sends a magic link to the provided email for signup
 */
export async function sendMagicLink(formData: FormData) {
  const email = formData.get("email") as string;
  const displayName = (formData.get("displayName") as string) || undefined;

  // Validate inputs
  if (!email) {
    return { error: "Email is required" };
  }

  try {
    // Get origin for redirect URL
    const origin =
      process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000";

    // Get the server Nhost client
    const nhost = await createNhostClient();

    // Send magic link
    const response = await nhost.auth.signInPasswordlessEmail({
      email,
      options: {
        displayName,
        redirectTo: `${origin}/verify`,
      },
    });

    if (response.body) {
      return { redirect: "/signup?magic=success" };
    }

    // If we got here, something went wrong
    return { error: "Failed to send magic link" };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to send magic link: ${error.message}`,
    };
  }
}

/**
 * Initiates WebAuthn registration process (sign up)
 */
export async function signUpWebauthn({
  email,
  displayName,
}: {
  email: string;
  displayName?: string;
}) {
  // Validate inputs
  if (!email) {
    return { error: "Email is required" };
  }

  try {
    // Get the server Nhost client
    const nhost = await createNhostClient();

    // Request registration options from server
    const response = await nhost.auth.signUpWebauthn({
      email,
      options: {
        displayName,
      },
    });

    // Return the challenge data for the client
    return {
      publicKeyCredentialCreationOptions: response.body,
    };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to initiate WebAuthn sign up: ${error.message}`,
    };
  }
}

/**
 * Verifies WebAuthn registration response
 */
export async function verifySignUpWebauthn(
  credential: CredentialCreationResponse,
  nickname: string,
) {
  try {
    // Get the server Nhost client
    const nhost = await createNhostClient();

    const response = await nhost.auth.verifySignUpWebauthn({
      credential,
      nickname,
    });

    // If we have a session, verification was successful
    if (response.body?.session) {
      // Revalidate all paths to ensure server components re-render
      revalidatePath("/");

      // Return redirect to profile page
      return { redirect: "/profile" };
    }

    // If we got here, something went wrong
    return { error: "Failed to verify WebAuthn registration" };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to verify WebAuthn registration: ${error.message}`,
    };
  }
}
