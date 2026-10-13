'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { createNhostClient } from '@/lib/nhost/server';

// Same convention as `@/lib/nhost/actions`: return { error }, never throw to
// the client, and never `redirect()` (see the comment there for why).
type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

const SIGNED_OUT = 'You are signed out. Sign in and try again.';

export type MfaSetup = { imageUrl: string; totpSecret: string };

// Asks the backend for a fresh secret. Nothing changes on the account until
// `enableMfa` confirms it with a code, so an abandoned setup costs nothing.
export async function generateMfa(): Promise<
  ActionResult & { setup?: MfaSetup }
> {
  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    const { body } = await nhost.auth.changeUserMfa();

    return { setup: { imageUrl: body.imageUrl, totpSecret: body.totpSecret } };
  } catch (err) {
    return { error: `Could not start the setup: ${errorMessage(err)}` };
  }
}

// The code proves the authenticator app holds the secret the backend just
// issued. From here on, password sign-in asks for one.
export async function enableMfa(code: string): Promise<ActionResult> {
  if (!code) {
    return { error: 'Enter the code from your authenticator app.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.verifyChangeUserMfa({ code, activeMfaType: 'totp' });

    return { success: true };
  } catch (err) {
    return { error: `Could not turn on two-factor: ${errorMessage(err)}` };
  }
}

// Turning it off takes a current code too, so a stolen session alone is not
// enough to strip the account of its second factor.
export async function disableMfa(code: string): Promise<ActionResult> {
  if (!code) {
    return { error: 'Enter the code from your authenticator app.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.verifyChangeUserMfa({ code, activeMfaType: '' });

    return { success: true };
  } catch (err) {
    return { error: `Could not turn off two-factor: ${errorMessage(err)}` };
  }
}
