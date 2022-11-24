import { NhostClient } from '@nhost/nextjs';
import { LOCAL_SUBDOMAIN } from './env';

export const nhost =
  process.env.NEXT_PUBLIC_NHOST_PLATFORM === 'true'
    ? new NhostClient({ backendUrl: process.env.NEXT_PUBLIC_NHOST_BACKEND_URL })
    : new NhostClient({ subdomain: LOCAL_SUBDOMAIN });

export default nhost;
