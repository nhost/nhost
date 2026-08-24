import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { NhostClient } from '@nhost/nhost-js';
import { describe, expect, it, vi } from 'vitest';
import { gqlRequest } from './graphql';

const doc = {
  kind: 'Document',
  definitions: [],
} as unknown as TypedDocumentNode<{ ok: boolean }, Record<string, never>>;

function clientReturning(body: unknown): NhostClient {
  return {
    graphql: { request: vi.fn().mockResolvedValue({ body }) },
  } as unknown as NhostClient;
}

describe('gqlRequest', () => {
  it('returns the data payload', async () => {
    const client = clientReturning({ data: { ok: true } });
    await expect(gqlRequest(client, doc, {})).resolves.toEqual({ ok: true });
  });

  it('throws when the response carries GraphQL errors', async () => {
    const client = clientReturning({ errors: [{ message: 'boom' }] });
    await expect(gqlRequest(client, doc, {})).rejects.toThrow('boom');
  });

  it('throws when data is missing', async () => {
    const client = clientReturning({});
    await expect(gqlRequest(client, doc, {})).rejects.toThrow(
      'did not include data',
    );
  });
});
