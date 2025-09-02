"use server";

import type {
  CredentialAssertionResponse,
  ErrorResponse,
} from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { revalidatePath } from "next/cache";
import { createNhostClient } from "../lib/nhost/server";

/**
 * Signs in a user with email and password
 */
export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validate inputs
  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    // Get the server Nhost client
    const nhost = await createNhostClient();

    // Sign in with email and password
    const response = await nhost.auth.signInEmailPassword({
      email,
      password,
    });

    // Check if MFA is required
    if (response.body.mfa) {
      // Return redirect URL for MFA
      return { redirect: `/signin/mfa?ticket=${response.body.mfa.ticket}` };
    }

    // If we have a session, sign in was successful
    if (response.body.session) {
      // Revalidate all paths to ensure server components re-render
      revalidatePath("/");

      // Return redirect to profile page
      return { redirect: "/profile" };
    }

    // If we got here, something went wrong
    return { error: "Failed to sign in: unexpected error" };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to sign in: ${error.message}`,
    };
  }
}

/**
 * Verifies MFA code for sign in
 */
export async function verifyMfa(formData: FormData) {
  const otp = formData.get("otp") as string;
  const ticket = formData.get("ticket") as string;

  // Validate inputs
  if (!otp || !ticket) {
    return { error: "Verification code and ticket are required" };
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

      // Return redirect to profile page
      return { redirect: "/profile" };
    }

    // If we got here, something went wrong
    return { error: "Failed to verify MFA code", ticket };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to verify MFA code: ${error.message}`,
      ticket,
    };
  }
}

/**
 * Sends a magic link to the provided email
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
      return { redirect: "/signin?magic=success" };
    }

    // If we got here, something went wrong
    return { error: "Failed to send magic link" };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to sign in: ${error.message}`,
    };
  }
}

/**
 * Gets the URL for social provider sign in
 */
export async function getProviderSignInUrl(provider: "github") {
  try {
    // Get origin for redirect URL
    const origin =
      process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000";
    const redirectTo = `${origin}/verify`;

    // Get the server Nhost client
    const nhost = await createNhostClient();

    // Get provider URL
    const url = nhost.auth.signInProviderURL(provider, {
      redirectTo,
    });

    return { url };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to create provider URL: ${error.message}`,
    };
  }
}

/**
 * Initiates WebAuthn sign in process
 * Server side function that gets authentication options from Nhost
 */
export async function signInWebauthn() {
  try {
    // Get the server Nhost client
    const nhost = await createNhostClient();

    // Request authentication options from server
    const response = await nhost.auth.signInWebauthn({});

    // Return the challenge data for the client
    return {
      publicKeyCredentialRequestOptions: response.body,
    };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to initiate WebAuthn sign in: ${error.message}`,
    };
  }
}

/**
 * Verifies WebAuthn authentication response
 * This is called after the user has completed the WebAuthn authentication
 */
export async function verifySignInWebauthn(
  credential: CredentialAssertionResponse,
) {
  try {
    // Get the server Nhost client
    const nhost = await createNhostClient();

    const response = await nhost.auth.verifySignInWebauthn({
      credential,
    });

    // If we have a session, verification was successful
    if (response.body?.session) {
      // Revalidate all paths to ensure server components re-render
      revalidatePath("/");

      // Return redirect to profile page
      return { redirect: "/profile" };
    }

    // If we got here, something went wrong
    return { error: "Failed to verify WebAuthn authentication" };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      error: `Failed to verify WebAuthn authentication: ${error.message}`,
    };
  }
}
