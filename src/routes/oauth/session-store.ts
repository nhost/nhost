import { SessionData, Store } from 'express-session';

import { pgClient } from '@/utils';

export class SessionStore extends Store {
  constructor(options = {}) {
    super(options);
  }
  destroy(id: string, callback: (err: unknown) => void) {
    pgClient
      .deleteProviderRequest(id)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }
  get(
    id: string,
    callback: (err: unknown, session: SessionData | null) => void
  ) {
    pgClient
      .providerRequest(id)
      .then(({ options }) => callback(null, options))
      .catch((err) => callback(err, null));
  }
  set(id: string, session: SessionData, callback: (err: unknown) => void) {
    pgClient
      .insertProviderRequest(id, session)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }
}
