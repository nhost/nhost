import { yupResolver } from '@hookform/resolvers/yup';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, vi } from 'vitest';
import { Form } from '@/components/form/Form';
import { editPermissionFormValidationSchemas } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import { hasuraColumnMetadataQuery } from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import RowPermissionsSection from './RowPermissionsSection';

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
  action,
}: {
  children: ReactNode;
  defaultValues?: Partial<RolePermissionEditorFormValues>;
  action: DatabaseAction;
}) {
  const methods = useForm<RolePermissionEditorFormValues>({
    defaultValues: {
      filter: {},
      limit: null,
      ...defaultValues,
    },
    resolver: yupResolver(editPermissionFormValidationSchemas[action]),
  });

  return (
    <FormProvider {...methods}>
      <Form onSubmit={mocks.onSubmit}>{children}</Form>
    </FormProvider>
  );
}

function renderRowPermissionsSection(
  props: Partial<{
    role: string;
    action: DatabaseAction;
    schema: string;
    table: string;
    disabled: boolean;
  }> = {},
  formDefaultValues?: Partial<RolePermissionEditorFormValues>,
) {
  const defaultProps = {
    role: 'user',
    action: 'insert' as DatabaseAction,
    schema: 'public',
    table: 'actor',
    disabled: false,
    ...props,
  };
  const { action } = props;

  return render(
    <TestWrapper defaultValues={formDefaultValues} action={action!}>
      <RowPermissionsSection {...defaultProps} />
      <button type="submit" data-testid="submitButton">
        Submit
      </button>
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

describe('RowPermissionsSection', () => {
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

  it('the Without any checks selected when there are no filters', () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderRowPermissionsSection();
    expect(screen.getByLabelText('Without any checks')).toBeChecked();
  });

  it('the Without any checks NOT selected when there are filters', () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    waitFor(async () => {
      renderRowPermissionsSection(undefined, {
        filter: {
          rules: [{ column: 'id', operator: '_eq', value: 'x-hasura-user-id' }],
        },
      });
    });
    expect(screen.getByLabelText('Without any checks')).not.toBeChecked();
    expect(screen.getByLabelText('With custom check')).toBeChecked();
  });

  it('should show validation errors and clear on column and operator change', async () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderRowPermissionsSection({ action: 'insert' });

    await TestUserEvent.fireClickEvent(
      screen.getByLabelText('With custom check'),
    );
    expect(screen.getByLabelText('With custom check')).toBeChecked();

    expect(await screen.findByText('Select a column')).toBeInTheDocument();
    // await TestUserEvent.fireClickEvent(screen.getByText('Select a column'));

    await TestUserEvent.fireClickEvent(screen.getByTestId('submitButton'));
    expect(screen.getByText('Please select a column.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a value.')).toBeInTheDocument();
  });
  it('should clear errors when columns or operator changes', async () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    renderRowPermissionsSection({ action: 'insert' });

    await TestUserEvent.fireClickEvent(
      screen.getByLabelText('With custom check'),
    );
    expect(screen.getByLabelText('With custom check')).toBeChecked();

    expect(await screen.findByText('Select a column')).toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByTestId('submitButton'));
    expect(screen.getByText('Please select a column.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a value.')).toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByText('Select a column'));

    const idOption = screen.getByText('id');
    await TestUserEvent.fireClickEvent(idOption);

    expect(idOption).not.toBeInTheDocument();

    const selectedColumn = screen.getByText('id');

    expect(selectedColumn).toBeInTheDocument();
    expect(
      screen.queryByText('Please select a column.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Please enter a value.')).not.toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByTestId('submitButton'));

    expect(screen.getByText('Please enter a value.')).toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByText('_eq'));

    await TestUserEvent.fireClickEvent(screen.getByText('_is_null'));

    expect(screen.getByText('Is null?')).toBeInTheDocument();
    expect(screen.queryByText('Please enter a value.')).not.toBeInTheDocument();
  });
});
