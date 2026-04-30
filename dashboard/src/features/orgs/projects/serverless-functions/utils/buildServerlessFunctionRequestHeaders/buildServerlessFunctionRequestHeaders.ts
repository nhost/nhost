import type { KeyValuePair } from '@/features/orgs/projects/serverless-functions/types';

export default function buildServerlessFunctionRequestHeaders(
  headerPairs: KeyValuePair[],
  isMultipart: boolean,
): Record<string, string> {
  const headersObj: Record<string, string> = {};
  for (const h of headerPairs) {
    if (!h.key) {
      continue;
    }
    if (isMultipart && h.key.trim().toLowerCase() === 'content-type') {
      continue;
    }
    headersObj[h.key] = h.value;
  }

  return headersObj;
}
