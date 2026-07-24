/// <reference types="node" />
/// <reference types="vitest/globals" />

import { customFetch } from '@/utils/hasura-api/customFetch';

const originalEnv = { ...process.env };
const fetchMock = vi.fn();

function mockResponse(body = '{}', status = 200) {
  fetchMock.mockResolvedValueOnce({
    status,
    text: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  });
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_NHOST_PLATFORM: 'false',
    NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL:
      'https://local.hasura.local.nhost.run/apis/migrate',
  };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('customFetch', () => {
  it('uses the dedicated migrations endpoint in local mode', async () => {
    mockResponse();

    await customFetch('/apis/migrate', {
      baseUrl: 'https://local.graphql.local.nhost.run',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://local.hasura.local.nhost.run/apis/migrate',
      expect.anything(),
    );
  });

  it('appends the migration path when local configuration provides a base URL', async () => {
    process.env.NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL =
      'https://local.hasura.local.nhost.run/';
    mockResponse();

    await customFetch('/apis/migrate', {
      baseUrl: 'https://local.graphql.local.nhost.run',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://local.hasura.local.nhost.run/apis/migrate',
      expect.anything(),
    );
  });

  it('uses the provided base URL for other local Hasura API calls', async () => {
    mockResponse();

    await customFetch('/v1/metadata', {
      baseUrl: 'https://local.graphql.local.nhost.run',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://local.graphql.local.nhost.run/v1/metadata',
      expect.anything(),
    );
  });

  it('uses the project-specific migration URL in platform mode', async () => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    mockResponse();

    await customFetch('/apis/migrate', {
      baseUrl: 'https://project.hasura.eu-west-1.nhost.run',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.hasura.eu-west-1.nhost.run/apis/migrate',
      expect.anything(),
    );
  });

  it('reports invalid JSON responses', async () => {
    mockResponse('not-json');

    await expect(customFetch('/v1/metadata')).rejects.toThrow(
      'Failed to parse Hasura API response as JSON',
    );
  });
});
