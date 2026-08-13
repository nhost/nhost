import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  executeMetadataMutation,
  LocalMetadataPersistenceError,
} from '@/features/orgs/projects/database/native-queries/utils/execute-metadata-mutation';
import type { NativeQueryMetadataBulkOperation } from '@/utils/hasura-api/generated/schemas';
import { MetadataExportError } from '@/utils/hasura-api/metadataExportFetch';

const API = 'https://local.hasura.local.nhost.run';
const operation: NativeQueryMetadataBulkOperation = {
  type: 'bulk_atomic',
  resource_version: 1,
  args: [
    {
      type: 'pg_untrack_logical_model',
      args: { source: 'default', name: 'result' },
    },
  ],
};

let exportRequests = 0;
let metadataStatus = 200;
let exportStatus = 200;

const server = setupServer(
  http.post(`${API}/v1/metadata`, () =>
    metadataStatus === 200
      ? HttpResponse.json({ message: 'success' })
      : HttpResponse.json({ error: 'metadata failed' }, { status: 500 }),
  ),
  http.get(`${API}/apis/metadata`, () => {
    exportRequests += 1;
    return exportStatus === 200
      ? HttpResponse.json({ resource_version: 2, metadata: {} })
      : HttpResponse.json({ error: 'export failed' }, { status: 500 });
  }),
);

const options = (onPartialSuccess = vi.fn().mockResolvedValue(undefined)) => ({
  appUrl: API,
  adminSecret: 'secret',
  isPlatform: false,
  onPartialSuccess,
});

describe('executeMetadataMutation', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    exportRequests = 0;
    metadataStatus = 200;
    exportStatus = 200;
  });
  afterAll(() => server.close());

  it('returns after metadata in platform mode without exporting', async () => {
    await expect(
      executeMetadataMutation(operation, {
        ...options(),
        isPlatform: true,
      }),
    ).resolves.toEqual({ message: 'success' });
    expect(exportRequests).toBe(0);
  });

  it('does not export when metadata fails', async () => {
    metadataStatus = 500;

    await expect(executeMetadataMutation(operation, options())).rejects.toThrow(
      'metadata failed',
    );
    expect(exportRequests).toBe(0);
  });

  it('exports exactly once after a local metadata success', async () => {
    await expect(
      executeMetadataMutation(operation, options()),
    ).resolves.toEqual({ message: 'success' });
    expect(exportRequests).toBe(1);
  });

  it('preserves the export error as cause and refreshes exactly once', async () => {
    exportStatus = 500;
    const onPartialSuccess = vi.fn().mockResolvedValue(undefined);

    const error = await executeMetadataMutation(
      operation,
      options(onPartialSuccess),
    ).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(LocalMetadataPersistenceError);
    expect(error).toMatchObject({
      message:
        'Hasura metadata was updated, but it could not be saved to local metadata files.',
      cause: expect.any(MetadataExportError),
    });
    expect(exportRequests).toBe(1);
    expect(onPartialSuccess).toHaveBeenCalledOnce();
  });

  it('keeps the persistence error when the refresh also fails', async () => {
    exportStatus = 500;
    const onPartialSuccess = vi
      .fn()
      .mockRejectedValue(new Error('refresh failed'));

    const error = await executeMetadataMutation(
      operation,
      options(onPartialSuccess),
    ).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(LocalMetadataPersistenceError);
    expect(error).toHaveProperty('cause', expect.any(MetadataExportError));
    expect(onPartialSuccess).toHaveBeenCalledOnce();
  });
});
