import type { KeyValuePair } from '@/features/orgs/projects/serverless-functions/types';

export default function buildServerlessFunctionRequestUrl(
  endpointUrl: string,
  params: KeyValuePair[],
): string {
  const queryString = params
    .filter((p) => p.key)
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');

  return queryString ? `${endpointUrl}?${queryString}` : endpointUrl;
}
