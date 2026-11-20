import type { StoredSession } from '@nhost/nhost-js/session';

declare global {
  namespace App {
    // What src/hooks.server.ts found out about this request's session.
    interface Locals {
      session: StoredSession | null;
      pendingReset: string | null;
      // A refresh this request lost: its cookies stay, for the request that
      // won, but this request is signed out.
      sessionRejected: boolean;
    }
  }
}
