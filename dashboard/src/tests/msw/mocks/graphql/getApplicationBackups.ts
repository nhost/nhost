import { HttpResponse } from 'msw';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';

export const MOCK_BACKUP_ID = 'backup-1';

export const getApplicationBackups = nhostGraphQLLink.query(
  'getApplicationBackups',
  ({ variables }) =>
    HttpResponse.json({
      data: {
        app: {
          id: variables.appId,
          backups: [
            {
              id: MOCK_BACKUP_ID,
              size: 1024,
              createdAt: '2026-07-20T12:00:00.000Z',
              completedAt: '2026-07-20T12:01:00.000Z',
            },
          ],
        },
      },
    }),
);
