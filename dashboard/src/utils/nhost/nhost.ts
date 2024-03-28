import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getStorageServiceUrl,
} from '@/utils/env';
import { NhostClient } from '@nhost/nextjs';

const nhost = new NhostClient({
  authUrl: getAuthServiceUrl(),
  graphqlUrl: getGraphqlServiceUrl(),
  functionsUrl: getFunctionsServiceUrl(),
  storageUrl: getStorageServiceUrl(),
});

export default nhost;
