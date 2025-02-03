import { mockOrganization, mockOrganizations } from '@/tests/mocks';
import nhostGraphQLLink from './nhostGraphQLLink';

export const getOrganizations = nhostGraphQLLink.query(
  'getOrganizations',
  (_req, res, ctx) =>
    res(
      ctx.data({
        organizations: mockOrganizations,
      }),
    ),
);

export const getOrganization = nhostGraphQLLink.query(
  'getOrganization',
  (_req, res, ctx) =>
    res(
      ctx.data({
        organizations: [{ ...mockOrganization }],
      }),
    ),
);
