'use server';

import { createNhostClient } from '@/lib/nhost/server';

export type ConnectionResult = {
  ok: boolean;
  latencyMs: number;
};

/**
 * Sends a real GraphQL request to the backend and times it.
 *
 * `{ __typename }` is the cheapest query the API will answer, so this measures
 * the round trip rather than the resolver. Run from the server, which is the
 * half whose connectivity the home page reports on.
 */
export async function testConnection(): Promise<ConnectionResult> {
  const started = Date.now();

  try {
    const nhost = await createNhostClient();
    await nhost.graphql.request({ query: '{ __typename }' });

    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    console.error('testConnection failed:', err);

    return { ok: false, latencyMs: Date.now() - started };
  }
}
