import type { NhostClient } from '@nhost/nhost-js-beta';
import { createContext } from 'react';

export const NhostContext = createContext<NhostClient>({} as NhostClient);
