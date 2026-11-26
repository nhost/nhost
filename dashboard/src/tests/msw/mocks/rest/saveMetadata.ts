import { HttpResponse, http } from 'msw';
import type {
  ErrorResponse,
  SaveMetadataResponse,
} from '@/utils/hasura-api/generated/schemas';

const saveMetadataUrl = 'https://local.hasura.local.nhost.run/apis/metadata';

export const saveMetadataHandler = http.get(saveMetadataUrl, () =>
  HttpResponse.json<SaveMetadataResponse>({ metadata: 'Success' }),
);

export const saveMetadataErrorHandler = http.get(saveMetadataUrl, () =>
  HttpResponse.json<ErrorResponse>(
    { code: 'internal_error', message: 'permission denied' },
    { status: 500 },
  ),
);
