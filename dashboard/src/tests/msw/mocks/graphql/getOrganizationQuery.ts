import { HttpResponse } from 'msw';
import {
  type GetOrganizationQuery,
  type GetOrganizationQueryVariables,
  type GetOrganizationsQuery,
  type GetOrganizationsQueryVariables,
  Sla_Level_Enum,
} from '@/generated/graphql';
import { mockOrganization, mockOrganizations } from '@/tests/mocks';
import nhostGraphQLLink from './nhostGraphQLLink';

// mockOrganizations is typed against the singular query, whose plan has no
// slaLevel; the plural document selects it.
const organizationListItems = mockOrganizations.map((organization) => ({
  ...organization,
  plan: {
    ...organization.plan,
    slaLevel: Sla_Level_Enum.None,
  },
})) satisfies GetOrganizationsQuery['organizations'];

export const getOrganizations = nhostGraphQLLink.query<
  GetOrganizationsQuery,
  GetOrganizationsQueryVariables
>('getOrganizations', () =>
  HttpResponse.json({
    data: { organizations: organizationListItems },
  }),
);

export const getOrganization = nhostGraphQLLink.query<
  GetOrganizationQuery,
  GetOrganizationQueryVariables
>('getOrganization', () =>
  HttpResponse.json({
    data: { organizations: [{ ...mockOrganization }] },
  }),
);
