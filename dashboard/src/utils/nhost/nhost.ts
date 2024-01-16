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
  ? new NhostClient({
      authUrl: getAuthServiceUrl(),
      graphqlUrl: getGraphqlServiceUrl(),
      functionsUrl: getFunctionsServiceUrl(),
      storageUrl: getStorageServiceUrl(),
    })
  : new NhostClient({ subdomain: 'local' });

export default nhost;
