import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import * as v from 'valibot';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
} from '#lib/nhost/errors.ts';
import { createNhostClient } from '#lib/nhost/server.ts';
import { command } from '$app/server';
import { codePageURL } from './link.ts';

export const sendCode = command(
  v.object({ email: v.string(), next: v.string() }),
  async ({ email, next }): Promise<ActionResult> => {
    if (!email) {
      return { error: 'Enter your email address.' };
    }

    try {
      const nhost = createNhostClient();
      await nhost.auth.signInOTPEmail({
        email,
        options: { redirectTo: codePageURL(email, next) },
      });
      return { success: true };
    } catch (err) {
      return {
        error: `Could not send the code: ${errorMessage(err, RETRY_IN.email)}`,
      };
    }
  },
);

// Sending a code replaces the last one, so a code from an earlier email is
// wrong too. Auth burns the code after five wrong tries.
const WRONG_CODE =
  'That code did not work. Use the code from the most recent email, or send a new one.';
const NO_TRIES_LEFT =
  'Too many wrong codes, so that code no longer works. Send a new one.';

// A successful verify is the sign-in: the client's storage writes the session
// cookie, so the caller only has to navigate.
export const verifyCode = command(
  v.object({ email: v.string(), otp: v.string() }),
  async ({ email, otp }): Promise<ActionResult> => {
    // Pasted from the email, a code can bring spaces or a line break with it.
    const code = otp.replace(/\s/g, '');

    if (!email || !code) {
      return { error: 'Enter your email address and the code.' };
    }

    try {
      const nhost = createNhostClient();
      const { body } = await nhost.auth.verifySignInOTPEmail({
        email,
        otp: code,
      });

      if (!body?.session) {
        return { error: 'That code did not work. Try again.' };
      }

      return { success: true };
    } catch (err) {
      switch ((err as FetchError<ErrorResponse>).body?.error) {
        case 'invalid-otp':
          return { error: WRONG_CODE };
        case 'otp-too-many-attempts':
          return { error: NO_TRIES_LEFT };
      }
      return {
        error: `Could not verify the code: ${errorMessage(err, RETRY_IN.signIn)}`,
      };
    }
  },
);
