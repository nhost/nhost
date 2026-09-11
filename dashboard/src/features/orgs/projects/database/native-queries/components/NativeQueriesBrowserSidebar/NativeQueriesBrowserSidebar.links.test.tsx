import { LogicalModelListItem } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/LogicalModelListItem';
import { NativeQueryListItem } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueryListItem';
import { render, screen } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  router: {
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'analytics source',
      modelSlug: '',
      querySlug: '',
    },
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));

describe('native query sidebar links', () => {
  it('encodes the selected source in logical-model links', () => {
    render(
      <LogicalModelListItem
        model={{ name: 'invoice_result', fields: [] }}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'invoice_result' }),
    ).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/analytics%20source/models/invoice_result',
    );
  });

  it('encodes the selected source in native-query links', () => {
    render(
      <NativeQueryListItem
        query={{
          root_field_name: 'same_query',
          code: 'SELECT invoice_id',
          returns: 'invoice_result',
        }}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'same_query' })).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/analytics%20source/queries/same_query',
    );
  });
});
