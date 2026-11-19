import * as v from 'valibot';
import {
  type ActionResult,
  errorMessage,
  SIGNED_OUT,
} from '#lib/nhost/errors.ts';
import { createNhostClient, getVerifiedUser } from '#lib/nhost/server.ts';
import { command } from '$app/server';

export type MfaSetup = { imageUrl: string; totpSecret: string };

// Asks the backend for a fresh secret, which it stores on the account right
// away.
export const generateMfa = command(
  async (): Promise<ActionResult & { setup?: MfaSetup }> => {
    try {
      const user = await getVerifiedUser();

      if (!user) {
        return { error: SIGNED_OUT };
      }

      if (user.activeMfaType === 'totp') {
        return {
          error: 'Two-factor is already on. Reload the page to see its state.',
        };
      }

      const nhost = createNhostClient();
      const { body } = await nhost.auth.changeUserMfa();

      return {
        setup: { imageUrl: body.imageUrl, totpSecret: body.totpSecret },
      };
    } catch (err) {
      return { error: `Could not start the setup: ${errorMessage(err)}` };
    }
  },
);

// The code proves the authenticator app holds the secret the backend just
// issued. From here on, password sign-in asks for one.
export const enableMfa = command(
  v.string(),
  async (code): Promise<ActionResult> => {
    if (!code) {
      return { error: 'Enter the code from your authenticator app.' };
    }

    try {
      const nhost = createNhostClient();

      if (!nhost.getUserSession()) {
        return { error: SIGNED_OUT };
      }

      await nhost.auth.verifyChangeUserMfa({ code, activeMfaType: 'totp' });

      return { success: true };
    } catch (err) {
      return { error: `Could not turn on two-factor: ${errorMessage(err)}` };
    }
  },
);

// This page only turns it off with a current code, but that does not stop a
// stolen session: the auth service lets any session regenerate the secret
// directly and then produce codes from it.
export const disableMfa = command(
  v.string(),
  async (code): Promise<ActionResult> => {
    if (!code) {
      return { error: 'Enter the code from your authenticator app.' };
    }

    try {
      const nhost = createNhostClient();

      if (!nhost.getUserSession()) {
        return { error: SIGNED_OUT };
      }

      await nhost.auth.verifyChangeUserMfa({ code, activeMfaType: '' });

      return { success: true };
    } catch (err) {
      return { error: `Could not turn off two-factor: ${errorMessage(err)}` };
    }
  },
);
