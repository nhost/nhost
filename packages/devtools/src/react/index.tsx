'use client';

import { useEffect } from 'react';
import { mountNhostDevToolbar } from '../toolbar';
import type { BackendConfig } from '../types';

export type NhostDevToolbarProps = BackendConfig;

const noop = () => {};

/**
 * The Nhost development toolbar, as a React component.
 *
 * Renders nothing: the toolbar mounts itself into `document.body` from an
 * effect, so there is no markup to match on a server render and no wrapper in
 * the way of the app's own layout. Drop it anywhere that runs on the client.
 */
export function NhostDevToolbar({
  subdomain,
  region,
}: NhostDevToolbarProps = {}) {
  useEffect(() => {
    // A devDependency is still installed when the production build runs, so
    // importing this component is enough to carry it into that bundle. The
    // check sits inside the effect because bundlers replace
    // `process.env.NODE_ENV` with a literal and can then drop everything below
    // it; the `typeof` guard is for the bundlers that leave `process` undefined
    // instead. It is belt and braces either way: what actually decides is the
    // local-backend check inside `mountNhostDevToolbar`.
    if (
      typeof process !== 'undefined' &&
      process.env['NODE_ENV'] === 'production'
    ) {
      return noop;
    }
    return mountNhostDevToolbar({ subdomain, region });
  }, [subdomain, region]);

  return null;
}
