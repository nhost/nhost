import { yupResolver } from '@hookform/resolvers/yup';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { Form } from '@/components/form/Form';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import { hasuraColumnMetadataQuery } from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import { mockPointerEvent, render, screen, waitFor } from '@/tests/testUtils';

import StorageRowPermissionsSection from './StorageRowPermissionsSection';
import type { StorageAction, StoragePermissionEditorFormValues } from './types';
import storageValidationSchemas from './validationSchemas';

mockPointerEvent();

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  onSubmit: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function TestWrapper({
  children,
  defaultValues,
  storageAction,
}: {
  children: ReactNode;
  defaultValues?: Partial<StoragePermissionEditorFormValues>;
  storageAction: StorageAction;
}) {
  const methods = useForm<StoragePermissionEditorFormValues>({
    defaultValues: {
      filter: {},
      rowCheckType: 'none',
      ...defaultValues,
    },
    resolver: yupResolver(storageValidationSchemas[storageAction]),
  });

  return (
    <FormProvider {...methods}>
      <Form onSubmit={mocks.onSubmit}>{children}</Form>
    </FormProvider>
  );
}

function renderSection(
  props: Partial<{
    role: string;
    storageAction: StorageAction;
  }> = {},
  formDefaultValues?: Partial<StoragePermissionEditorFormValues>,
) {
  const defaultProps = {
    role: 'user',
    storageAction: 'download' as StorageAction,
    ...props,
  };

  return render(
    <TestWrapper
      defaultValues={formDefaultValues}
      storageAction={defaultProps.storageAction}
    >
      <StorageRowPermissionsSection {...defaultProps} />
    </TestWrapper>,
  );
}

const getBucketsQuery = nhostGraphQLLink.query('getBuckets', () =>
  HttpResponse.json({ data: { buckets: [] } }),
);

const server = setupServer(
  tableQuery,
  hasuraColumnMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
  getBucketsQuery,
);

function getRouter() {
  return {
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
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isFallback: false,
  };
}

describe('StorageRowPermissionsSection', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen();
  });

  beforeEach(() => {
    server.restoreHandlers();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('"Without any checks" is selected when there are no filters', () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderSection({ storageAction: 'download' });

    expect(screen.getByLabelText('Without any checks')).toBeChecked();
    expect(screen.getByLabelText('With custom check')).not.toBeChecked();
  });

  it('"With custom check" is selected when there are filters', () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderSection(
      { storageAction: 'upload' },
      {
        rowCheckType: 'custom',
        filter: {
          type: 'group',
          id: 'test-group-id',
          operator: '_and',
          children: [
            {
              type: 'condition',
              id: 'test-condition-id',
              column: 'id',
              operator: '_eq',
              value: 'x-hasura-user-id',
            },
          ],
        },
      },
    );

    expect(screen.getByLabelText('Without any checks')).not.toBeChecked();
    expect(screen.getByLabelText('With custom check')).toBeChecked();
  });

  it('shows CustomCheckEditor with "Add check" button when switching to custom', async () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderSection({ storageAction: 'download' });

    expect(screen.queryByText('Add check')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('With custom check'));

    await waitFor(() => {
      expect(screen.getByText('Add check')).toBeInTheDocument();
    });
  });

  it('hides CustomCheckEditor when switching back to "none"', async () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderSection(
      { storageAction: 'download' },
      {
        rowCheckType: 'custom',
        filter: {
          type: 'group',
          id: 'g1',
          operator: '_implicit',
          children: [],
        },
      },
    );

    expect(screen.getByText('Add check')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Without any checks'));

    await waitFor(() => {
      expect(screen.queryByText('Add check')).not.toBeInTheDocument();
    });
  });

  it('renders correct section title for each storage action', () => {
    mocks.useRouter.mockImplementation(() => getRouter());

    const cases: Array<{ action: StorageAction; title: string }> = [
      { action: 'download', title: 'File download permissions' },
      { action: 'upload', title: 'File upload permissions' },
      { action: 'replace', title: 'File replace permissions' },
      { action: 'delete', title: 'File delete permissions' },
    ];

    for (const { action, title } of cases) {
      const { unmount } = renderSection({ storageAction: action });
      expect(screen.getByText(title)).toBeInTheDocument();
      unmount();
    }
  });

  it('displays the role name and action in the description text', () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderSection({ role: 'editor', storageAction: 'upload' });

    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.getByText('upload')).toBeInTheDocument();
  });
});
