import { yupResolver } from '@hookform/resolvers/yup';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';

import { Form } from '@/components/form/Form';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import { hasuraColumnMetadataQuery } from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import { mockPointerEvent, render, screen } from '@/tests/testUtils';

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
    disabled: boolean;
  }> = {},
  formDefaultValues?: Partial<StoragePermissionEditorFormValues>,
) {
  const defaultProps = {
    role: 'user',
    storageAction: 'download' as StorageAction,
    disabled: false,
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

const server = setupServer(
  tableQuery,
  hasuraColumnMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
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
});
