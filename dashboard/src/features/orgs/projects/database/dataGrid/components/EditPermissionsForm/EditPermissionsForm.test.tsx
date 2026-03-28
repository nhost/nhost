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

// pg_relation_is_updatable(oid, true) returns a bitmask:
//   8  = insertable
//   4  = updatable
//   16 = deletable
// Combined values used in tests:
//   0  = none (select only)
//   8  = insert only
//   16 = delete only
//   20 = update + delete (4 + 16)
//   28 = insert + update + delete (8 + 4 + 16)
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

  it('should display all 4 actions for a table regardless of updatability', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="users"
        objectType="ORDINARY TABLE"
        updatability={0}
      />,
    );

    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should display all 4 actions for a foreign table', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="remote_users"
        objectType="FOREIGN TABLE"
      />,
    );

    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should display only Select for a materialized view', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="my_mat_view"
        objectType="MATERIALIZED VIEW"
        updatability={0}
      />,
    );

    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should display only Select for a non-updatable view (updatability=0)', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="complex_view"
        objectType="VIEW"
        updatability={0}
      />,
    );

    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should display all 4 actions for a fully updatable view (updatability=28)', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="simple_view"
        objectType="VIEW"
        updatability={28}
      />,
    );

    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should display Select and Update+Delete for a view that is updatable but not insertable (updatability=20)', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="partial_view"
        objectType="VIEW"
        updatability={20}
      />,
    );

    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Insert')).not.toBeInTheDocument();
  });

  it('should display Insert and Select for a view that is only insertable (updatability=8)', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="insert_only_view"
        objectType="VIEW"
        updatability={8}
      />,
    );

    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should display Select and Delete for a view with only delete trigger (updatability=16)', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="delete_trigger_view"
        objectType="VIEW"
        updatability={16}
      />,
    );

    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
  });

  it('should fall back to all actions for a view when updatability is not provided', () => {
    render(
      <EditPermissionsForm
        schema="public"
        table="unknown_view"
        objectType="VIEW"
      />,
    );

    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});
