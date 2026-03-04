import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import EditPermissionsForm from './EditPermissionsForm';

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project: { subdomain: 'test', region: 'us-east-1' } }),
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: () => ({ org: { slug: 'test-org' } }),
}));

vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => ({}),
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/utils/__generated__/graphql',
  );
  return {
    ...actual,
    useGetRemoteAppRolesQuery: () => ({
      data: { authRoles: [{ role: 'user' }] },
      loading: false,
      error: undefined,
    }),
  };
});

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    default: () => ({
      data: {
        columns: [{ column_name: 'id' }, { column_name: 'name' }],
      },
      status: 'success',
      error: null,
    }),
    useTableSchemaQuery: () => ({
      data: {
        columns: [{ column_name: 'id' }, { column_name: 'name' }],
      },
      status: 'success',
      error: null,
    }),
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery',
  () => ({
    default: () => ({
      data: { resourceVersion: 1, tables: [] },
      status: 'success',
      error: null,
    }),
    useMetadataQuery: () => ({
      data: { resourceVersion: 1, tables: [] },
      status: 'success',
      error: null,
    }),
  }),
);

describe('EditPermissionsForm', () => {
  it('should display all 4 action column headers for a table', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="users"
        objectType="ORDINARY TABLE"
      />,
    );

    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should display only Select column header for a materialized view', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="my_view"
        objectType="MATERIALIZED VIEW"
      />,
    );

    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
