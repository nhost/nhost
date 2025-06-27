import type { NhostClient } from '@nhost/nhost-js-beta';
import type { PropsWithChildren } from 'react';
import { NhostContext } from './NhostContext';

export interface NhostProviderProps {
  nhost: NhostClient;
}

function NhostProvider({
  nhost,
  children,
}: PropsWithChildren<NhostProviderProps>) {
  return (
    <NhostContext.Provider value={nhost}>{children}</NhostContext.Provider>
  );
}

export default NhostProvider;
