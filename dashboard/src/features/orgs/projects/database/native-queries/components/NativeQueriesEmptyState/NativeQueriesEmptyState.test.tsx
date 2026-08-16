import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { render, screen } from '@/tests/testUtils';

describe('NativeQueriesEmptyState', () => {
  it('renders the database search icon', () => {
    const { container } = render(
      <NativeQueriesEmptyState
        title="Native query not found"
        description="The native query does not exist."
      />,
    );

    expect(screen.getByText('Native query not found')).toBeInTheDocument();
    expect(
      container.querySelector('.lucide-database-search'),
    ).toBeInTheDocument();
    expect(container.querySelector('.lucide-boxes')).not.toBeInTheDocument();
  });
});
