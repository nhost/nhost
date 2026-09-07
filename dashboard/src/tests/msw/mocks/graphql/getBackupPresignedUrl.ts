import { HttpResponse } from 'msw';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';

export const getBackupPresignedUrlRequest: {
  variables?: Record<string, unknown>;
} = {};

export const getBackupPresignedUrl = nhostGraphQLLink.query(
  'GetBackupPresignedUrl',
  ({ variables }) => {
    getBackupPresignedUrlRequest.variables = variables;

    return HttpResponse.json({
      data: {
        getBackupPresignedUrl: {
          url: 'https://example.com/backup',
          expiresAt: '2026-07-20T13:00:00.000Z',
        },
      },
    });
  },
);
