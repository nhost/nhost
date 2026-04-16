import type { KeyValuePair } from '@/features/orgs/projects/serverless-functions/types';

export default function buildServerlessFunctionRequestHeaders(
  headerPairs: KeyValuePair[],
  isMultipart: boolean,
): Record<string, string> {
  const headersObj: Record<string, string> = {};
  for (const h of headerPairs) {
    if (h.key) {
      headersObj[h.key] = h.value;
    }
  }

  if (isMultipart) {
    delete headersObj['Content-Type'];
  }

  return headersObj;
}
