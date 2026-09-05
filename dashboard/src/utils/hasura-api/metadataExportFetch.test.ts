import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import {
  exportLocalMetadata,
  MetadataExportError,
} from '@/utils/hasura-api/metadataExportFetch';

const exportUrl = 'https://custom.migrate.example/apis/metadata';

const exportMetadataResponse: ExportMetadataResponse = {
  resource_version: 42,
  metadata: { version: 3, sources: [] },
};

const originalEnv = { ...process.env };

let capturedRequests: Request[] = [];

const server = setupServer(
  http.get(exportUrl, ({ request }) => {
    capturedRequests.push(request);
    return HttpResponse.json(exportMetadataResponse);
  }),
);

beforeAll(() => server.listen());
beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL:
      'https://custom.migrate.example/apis/migrate',
  };
});
afterEach(() => {
  server.resetHandlers();
  capturedRequests = [];
  process.env = { ...originalEnv };
});
afterAll(() => server.close());

describe('exportLocalMetadata', () => {
  it('performs a single GET with export=true as the sole query parameter', async () => {
    await exportLocalMetadata({ adminSecret: 'test-secret' });

    expect(capturedRequests).toHaveLength(1);

    const request = capturedRequests[0];
    expect(request.method).toBe('GET');
    expect(request.url).toBe(`${exportUrl}?export=true`);
    expect(request.body).toBeNull();
  });

  it('forwards the admin secret header', async () => {
    await exportLocalMetadata({ adminSecret: 'test-secret' });

    expect(capturedRequests[0].headers.get('x-hasura-admin-secret')).toBe(
      'test-secret',
    );
  });

  it('omits the admin secret header when not provided', async () => {
    await exportLocalMetadata();

    expect(capturedRequests[0].headers.get('x-hasura-admin-secret')).toBeNull();
  });

  it('returns the typed metadata payload on success', async () => {
    const result = await exportLocalMetadata({ adminSecret: 'test-secret' });

    expect(result.status).toBe(200);
    expect(result.data).toEqual(exportMetadataResponse);
    expect(result.data.resource_version).toBe(42);
  });

  it('throws a MetadataExportError with the parsed body on a JSON error response', async () => {
    server.use(
      http.get(exportUrl, () =>
        HttpResponse.json(
          { code: 'export_failed', error: 'could not write metadata files' },
          { status: 500 },
        ),
      ),
    );

    const error = await exportLocalMetadata({
      adminSecret: 'test-secret',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MetadataExportError);

    const exportError = error as MetadataExportError;
    expect(exportError.status).toBe(500);
    expect(exportError.body).toEqual({
      code: 'export_failed',
      error: 'could not write metadata files',
    });
    expect(exportError.message).toBe('could not write metadata files');
  });

  it('throws a MetadataExportError with the raw body on a plain text error response', async () => {
    server.use(
      http.get(
        exportUrl,
        () => new HttpResponse('metadata export failed', { status: 400 }),
      ),
    );

    const error = await exportLocalMetadata({
      adminSecret: 'test-secret',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MetadataExportError);

    const exportError = error as MetadataExportError;
    expect(exportError.status).toBe(400);
    expect(exportError.body).toBe('metadata export failed');
    expect(exportError.message).toBe('metadata export failed');
  });

  it('throws a MetadataExportError with a null body on an empty error response', async () => {
    server.use(
      http.get(exportUrl, () => new HttpResponse(null, { status: 502 })),
    );

    const error = await exportLocalMetadata({
      adminSecret: 'test-secret',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MetadataExportError);

    const exportError = error as MetadataExportError;
    expect(exportError.status).toBe(502);
    expect(exportError.body).toBeNull();
    expect(exportError.message).toBe(
      'Metadata export request failed with status 502',
    );
  });

  it('does not retry after an error response', async () => {
    server.use(
      http.get(exportUrl, ({ request }) => {
        capturedRequests.push(request);
        return new HttpResponse(null, { status: 500 });
      }),
    );

    await expect(
      exportLocalMetadata({ adminSecret: 'test-secret' }),
    ).rejects.toThrow(MetadataExportError);

    expect(capturedRequests).toHaveLength(1);
  });

  it('preserves the underlying cause on a network failure', async () => {
    server.use(http.get(exportUrl, () => HttpResponse.error()));

    const error = await exportLocalMetadata({
      adminSecret: 'test-secret',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);

    const networkError = error as Error;
    expect(networkError.message).toBe(
      'Failed to reach the metadata export API',
    );
    expect(networkError.cause).toBeDefined();
  });

  it('preserves the underlying cause when the success body is not valid JSON', async () => {
    server.use(
      http.get(exportUrl, () => new HttpResponse('not-json', { status: 200 })),
    );

    const error = await exportLocalMetadata({
      adminSecret: 'test-secret',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);

    const parseError = error as Error;
    expect(parseError.message).toBe(
      'Failed to parse the metadata export response as JSON',
    );
    expect(parseError.cause).toBeInstanceOf(SyntaxError);
  });
});
