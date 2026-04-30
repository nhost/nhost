import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { FormProvider, useForm, useFormState } from 'react-hook-form';
import { vi } from 'vitest';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import ColumnPresetsSection from './ColumnPresetsSection';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const server = setupServer(
  tokenQuery,
  tableQuery,
  hasuraMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
);

function DirtyProbe() {
  const { isDirty } = useFormState();
  return <span data-testid="is-dirty">{isDirty ? 'dirty' : 'clean'}</span>;
}

function TestWrapper({
  children,
  columnPresets = [{ column: '', value: '' }],
}: {
  children: ReactNode;
  columnPresets?: { column: string; value: string }[];
}) {
  const form = useForm({ defaultValues: { columnPresets } });
  return (
    <FormProvider {...form}>
      <DirtyProbe />
      {children}
    </FormProvider>
  );
}

const defaultProps = {
  schema: 'public',
  table: 'books',
};

describe('ColumnPresetsSection', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen();
  });

  beforeEach(() => {
    mockPointerEvent();
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/xyz/projects/test-project',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]',
      asPath: '/orgs/xyz/projects/test-project',
      isLocaleDomain: false,
      isReady: true,
      isPreview: false,
      query: {
        orgSlug: 'xyz',
        appSubdomain: 'test-project',
        dataSourceSlug: 'default',
      },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
      forward: vi.fn(),
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('stays clean on mount with the default empty preset row', async () => {
    render(
      <TestWrapper>
        <ColumnPresetsSection {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Column Name')).toBeInTheDocument();
    });

    expect(screen.getByTestId('is-dirty')).toHaveTextContent('clean');
  });

  it('"Add Column" appends a new empty row', async () => {
    render(
      <TestWrapper>
        <ColumnPresetsSection {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Delete preset' }),
      ).toHaveLength(1);
    });

    const user = new TestUserEvent();
    await user.click(screen.getByRole('button', { name: /add column/i }));

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Delete preset' }),
      ).toHaveLength(2);
    });
  });

  it('removing the last remaining row keeps one empty placeholder row', async () => {
    render(
      <TestWrapper
        columnPresets={[{ column: 'title', value: 'X-Hasura-User-Id' }]}
      >
        <ColumnPresetsSection {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument();
    });

    const user = new TestUserEvent();
    await user.click(screen.getByRole('button', { name: 'Delete preset' }));

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Delete preset' }),
      ).toHaveLength(1);
      expect(screen.queryByText('title')).not.toBeInTheDocument();
      expect(screen.getByText('Select column')).toBeInTheDocument();
    });
  });

  it('a column used in one row is disabled in other rows but remains selectable in its own row', async () => {
    render(
      <TestWrapper
        columnPresets={[
          { column: 'title', value: '' },
          { column: '', value: '' },
        ]}
      >
        <ColumnPresetsSection {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('Select column')).toBeInTheDocument();
    });

    const row0ColumnTrigger = screen
      .getByText('title')
      .closest('[role="combobox"]') as HTMLElement;
    const row1ColumnTrigger = screen
      .getByText('Select column')
      .closest('[role="combobox"]') as HTMLElement;

    const user = new TestUserEvent();

    await user.click(row1ColumnTrigger);

    const titleOptionInOtherRow = await screen.findByRole('option', {
      name: 'title',
    });
    expect(titleOptionInOtherRow).toHaveAttribute('data-disabled');

    const releaseDateOption = screen.getByRole('option', {
      name: 'release_date',
    });
    expect(releaseDateOption).not.toHaveAttribute('data-disabled');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'title' })).toBeNull();
    });

    await user.click(row0ColumnTrigger);

    const titleOptionInOwnRow = await screen.findByRole('option', {
      name: 'title',
    });
    expect(titleOptionInOwnRow).not.toHaveAttribute('data-disabled');
  });
});
