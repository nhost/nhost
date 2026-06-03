import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createAPIClient } from '../client';

const mockFetch = jest.fn();

global.fetch = mockFetch as unknown as typeof global.fetch;

describe('GraphQL client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  test('keeps the JSON content type when request options include headers', async () => {
    const client = createAPIClient('https://api.example.com/graphql');

    await client.request(
      { query: 'query Test { test }' },
      {
        headers: {
          Authorization: 'Bearer token',
        },
      },
    );

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);

    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer token');
  });
});
