import { HttpResponse, http } from 'msw';
import type {
  ActionItem,
  CustomTypes,
  ExportMetadataResponse,
} from '@/utils/hasura-api/generated/schemas';

/**
 * Base URL the dashboard talks to when running in local (non-platform) mode.
 * Both the metadata read (`export_metadata`) and migration writes
 * (`/apis/migrate`) are served from here under test.
 */
export const HASURA_API_URL = 'https://local.hasura.local.nhost.run';

export const sampleCustomTypes: CustomTypes = {
  scalars: [],
  enums: [],
  input_objects: [
    {
      name: 'SampleInput',
      fields: [
        { name: 'username', type: 'String!' },
        { name: 'password', type: 'String!' },
      ],
    },
  ],
  objects: [
    {
      name: 'SampleOutput',
      fields: [{ name: 'accessToken', type: 'String!' }],
    },
  ],
};

export const sampleMutationAction: ActionItem = {
  name: 'login',
  comment: 'Logs a user in',
  definition: {
    handler: 'https://example.com/login',
    output_type: 'SampleOutput',
    arguments: [{ name: 'credentials', type: 'SampleInput!' }],
    type: 'mutation',
    kind: 'synchronous',
    forward_client_headers: false,
    timeout: 30,
    headers: [],
  },
  permissions: [{ role: 'user' }],
};

export const sampleQueryAction: ActionItem = {
  name: 'getProfile',
  definition: {
    handler: 'https://example.com/profile',
    output_type: 'SampleOutput',
    arguments: [],
    type: 'query',
    forward_client_headers: true,
    timeout: 30,
    headers: [],
  },
};

export const sampleActions: ActionItem[] = [
  sampleMutationAction,
  sampleQueryAction,
];

export interface ExportMetadataResponseOptions {
  actions?: ActionItem[];
  customTypes?: CustomTypes;
  resourceVersion?: number;
}

export function buildExportMetadataResponse({
  actions = sampleActions,
  customTypes = sampleCustomTypes,
  resourceVersion = 1,
}: ExportMetadataResponseOptions = {}): ExportMetadataResponse {
  return {
    resource_version: resourceVersion,
    metadata: {
      version: 3,
      actions,
      custom_types: customTypes,
    },
  };
}

/**
 * MSW handler for the `export_metadata` read that `useGetActions` /
 * `useExportMetadata` issue. Only the `export_metadata` operation is served;
 * any other metadata operation on this endpoint fails loudly so a test that
 * accidentally routes a write here is easy to spot. Migration writes go to
 * `${HASURA_API_URL}/apis/migrate` and must be handled separately.
 */
export function createExportActionsMetadataHandler(
  options?: ExportMetadataResponseOptions,
) {
  const response = buildExportMetadataResponse(options);

  return http.post(`${HASURA_API_URL}/v1/metadata`, async ({ request }) => {
    const body = (await request.json()) as { type?: string };

    if (body?.type === 'export_metadata') {
      return HttpResponse.json(response);
    }

    return HttpResponse.json(
      {
        error: `Unhandled metadata operation in actions test fixture: ${body?.type}`,
      },
      { status: 500 },
    );
  });
}

export default createExportActionsMetadataHandler;
