import type { NhostClient } from '@nhost/nhost-js';
import { createContext } from 'react';

export const NhostContext = createContext<NhostClient>({} as NhostClient);