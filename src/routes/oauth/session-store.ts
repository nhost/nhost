import { SessionData, Store } from 'express-session';

import { gqlSdk } from '@/utils';

export class SessionStore extends Store {
  constructor(options = {}) {
    super(options);
  }
  destroy(id: string, callback: (err: unknown) => void) {
    gqlSdk
      .deleteProviderRequest({ id })
      .then(() => callback(null))
      .catch((err) => callback(err));
  }
  get(
    id: string,
    callback: (err: unknown, session: SessionData | null) => void
  ) {
    gqlSdk
      .providerRequest({ id })
      .then(({ authProviderRequest }) =>
        callback(null, authProviderRequest?.options)
      )
      .catch((err) => callback(err, null));
  }
  set(id: string, session: SessionData, callback: (err: unknown) => void) {
    gqlSdk
      .insertProviderRequest({
        providerRequest: {
          id,
          options: session,
        },
      })
      .then(() => callback(null))
      .catch((err) => callback(err));
  }
}
