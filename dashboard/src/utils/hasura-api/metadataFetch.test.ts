import { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';

const APP_URL = 'https://test.hasura.eu-west-1.nhost.run';
const ADMIN_SECRET = 'super-secret-token';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const operation = {
  type: 'export_metadata',
  version: 2,
  args: {},
} as const;
const fetchMock = vi.fn();

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('metadataOperation', () => {
  it('throws a safe typed error for the canonical Hasura conflict before callers flatten it', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { path: '$', error: CONFLICT_MESSAGE, code: 'conflict' },
        409,
      ),
    );

    let thrown: unknown;
    try {
      await metadataOperation(operation, {
        appUrl: APP_URL,
        adminSecret: ADMIN_SECRET,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MetadataVersionConflictError);
    expect(thrown).toMatchObject({
      message: CONFLICT_MESSAGE,
      origin: { appUrl: APP_URL },
    });
    expect(JSON.stringify(thrown)).not.toContain(ADMIN_SECRET);
    expect((thrown as Error).stack).not.toContain(ADMIN_SECRET);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('strips the Hasura target from RequestInit while retaining request headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'success' }, 200));

    await metadataOperation(operation, {
      appUrl: APP_URL,
      adminSecret: ADMIN_SECRET,
      headers: { 'x-test-header': 'test-value' },
    });

    const [url, requestInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & Record<string, unknown>,
    ];
    expect(url).toBe(`${APP_URL}/v1/metadata`);
    expect(requestInit).not.toHaveProperty('appUrl');
    expect(requestInit.headers).not.toHaveProperty('appUrl');
    expect(requestInit.headers).toEqual(
      expect.objectContaining({
        'x-hasura-admin-secret': ADMIN_SECRET,
        'x-test-header': 'test-value',
      }),
    );
  });

  it('returns an ordinary 409 unchanged', async () => {
    const data = { path: '$', error: 'already exists', code: 'conflict' };
    fetchMock.mockResolvedValue(jsonResponse(data, 409));

    await expect(
      metadataOperation(operation, {
        appUrl: APP_URL,
        adminSecret: ADMIN_SECRET,
      }),
    ).resolves.toMatchObject({ status: 409, data });
  });

  it('preserves network errors', async () => {
    const networkError = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(networkError);

    await expect(
      metadataOperation(operation, {
        appUrl: APP_URL,
        adminSecret: ADMIN_SECRET,
      }),
    ).rejects.toBe(networkError);
  });
});
