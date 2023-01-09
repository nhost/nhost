import { getLocalSubdomain } from '@/utils/env';
import { NhostClient } from '@nhost/nextjs';

export const nhost =
  process.env.NEXT_PUBLIC_NHOST_PLATFORM === 'true'
    ? new NhostClient({ backendUrl: process.env.NEXT_PUBLIC_NHOST_BACKEND_URL })
    : new NhostClient({ subdomain: getLocalSubdomain() });

export default nhost;
