import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import type { NativeQueryMetadataBulkOperation } from '@/utils/hasura-api/generated/schemas/nativeQueryMetadataBulkOperation';

const METADATA_BASE_URL = 'https://metadata.test';

const mixedBulkOperation: NativeQueryMetadataBulkOperation = {
  type: 'bulk_atomic',
  resource_version: 42,
  args: [
    {
      type: 'pg_untrack_logical_model',
      args: { source: 'default', name: 'invoice_summary' },
    },
    {
      type: 'pg_track_logical_model',
      args: {
        source: 'default',
        name: 'invoice_summary',
        fields: [
          {
            name: 'id',
            type: { scalar: 'uuid', nullable: false },
          },
          {
            name: 'line_items',
            type: {
              array: {
                logical_model: 'invoice_line_item',
                nullable: false,
              },
              nullable: false,
            },
          },
        ],
      },
    },
    {
      type: 'pg_create_logical_model_select_permission',
      args: {
        source: 'default',
        name: 'invoice_summary',
        role: 'user',
        permission: {
          columns: '*',
          filter: { customer_id: { _eq: 'X-Hasura-User-Id' } },
        },
      },
    },
  ],
};

const exportedMetadata = {
  resource_version: 43,
  metadata: {
    version: 3,
    sources: [
      {
        name: 'default',
        kind: 'postgres',
        logical_models: [
          {
            name: 'invoice_summary',
            fields: [
              { name: 'id', type: { scalar: 'uuid', nullable: false } },
              {
                name: 'tags',
                type: {
                  array: { scalar: 'text', nullable: true },
                  nullable: false,
                },
              },
              {
                name: 'customer',
                type: { logical_model: 'customer', nullable: false },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['id', 'customer'],
                  filter: { customer_id: { _eq: 'X-Hasura-User-Id' } },
                },
              },
            ],
          },
        ],
        native_queries: [
          {
            root_field_name: 'invoice_summaries',
            type: 'query',
            arguments: {
              customer_id: {
                type: 'uuid',
                nullable: false,
                description: 'Customer identifier',
              },
            },
            code: 'select * from invoices where customer_id = {{customer_id}}',
            returns: 'invoice_summary',
            object_relationships: [
              {
                name: 'customer',
                using: {
                  column_mapping: { customer_id: 'id' },
                  insertion_order: null,
                  remote_native_query: 'customers',
                },
              },
            ],
            array_relationships: [],
          },
        ],
      },
    ],
  },
} satisfies ExportMetadataResponse;

let capturedBody: unknown;

const server = setupServer(
  http.post(`${METADATA_BASE_URL}/v1/metadata`, async ({ request }) => {
    capturedBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
);

describe('native query and logical model metadata contract', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  beforeEach(() => {
    capturedBody = undefined;
  });

  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('serializes a mixed bulk_atomic operation through the generated client', async () => {
    const response = await metadataOperation(mixedBulkOperation, {
      baseUrl: METADATA_BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(capturedBody).toEqual(mixedBulkOperation);
  });

  it('round-trips representative exported field and relationship shapes', async () => {
    const fixtureResponse = new Response(JSON.stringify(exportedMetadata), {
      headers: { 'Content-Type': 'application/json' },
    });
    const roundTripped =
      (await fixtureResponse.json()) as ExportMetadataResponse;
    const source = roundTripped.metadata.sources?.[0];

    expect(source?.logical_models?.[0]?.fields).toEqual(
      exportedMetadata.metadata.sources[0].logical_models[0].fields,
    );
    expect(source?.logical_models?.[0]?.select_permissions).toEqual(
      exportedMetadata.metadata.sources[0].logical_models[0]
        .select_permissions,
    );
    expect(source?.native_queries).toEqual(
      exportedMetadata.metadata.sources[0].native_queries,
    );
  });
});
