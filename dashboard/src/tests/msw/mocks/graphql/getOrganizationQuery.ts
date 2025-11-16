import { mockOrganization, mockOrganizations } from '@/tests/mocks';
import { HttpResponse } from 'msw';
import nhostGraphQLLink from './nhostGraphQLLink';

export const getOrganizations = nhostGraphQLLink.query('getOrganizations', () =>
  HttpResponse.json({
    data: { organizations: mockOrganizations },
  }),
);

export const getOrganization = nhostGraphQLLink.query('getOrganization', () =>
  HttpResponse.json({
    data: { organizations: [{ ...mockOrganization }] },
  }),
);
