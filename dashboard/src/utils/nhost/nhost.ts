import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getStorageServiceUrl,
  isPlatform,
} from '@/utils/env';
import { NhostClient } from '@nhost/nextjs';

// eslint-disable-next-line no-nested-ternary
const nhost = isPlatform()
  ? new NhostClient({ backendUrl: process.env.NEXT_PUBLIC_NHOST_BACKEND_URL })
  : getAuthServiceUrl() &&
    getGraphqlServiceUrl() &&
    getStorageServiceUrl() &&
    getFunctionsServiceUrl()
  ? new NhostClient({
      authUrl: getAuthServiceUrl(),
      graphqlUrl: getGraphqlServiceUrl(),
      storageUrl: getStorageServiceUrl(),
      functionsUrl: getFunctionsServiceUrl(),
    })
  : new NhostClient({ subdomain: 'local' });

export default nhost;
