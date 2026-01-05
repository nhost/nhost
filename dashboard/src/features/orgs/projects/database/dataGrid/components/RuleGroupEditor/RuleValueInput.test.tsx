import * as useProject from '@/features/orgs/projects/hooks/useProject';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import RuleValueInput from './RuleValueInput';
import * as useRuleGroupEditor from './useRuleGroupEditor';

vi.mock('./useRuleGroupEditor');
vi.mock('@/features/orgs/projects/hooks/useProject');

const mocks = vi.hoisted(() => ({
  useGetRolesPermissionsQuery: vi.fn(),
  useForm: vi.fn(),
  setValueMock: vi.fn(),
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetRolesPermissionsQuery: mocks.useGetRolesPermissionsQuery,
  };
});

const mockUseRuleGroupEditor = useRuleGroupEditor.default as Mock;
const mockUseProject = useProject.useProject as Mock;

function TestWrapper({
  children,
  defaultValues = {},
}: {
  children: React.ReactNode;
  // biome-ignore lint/suspicious/noExplicitAny: test file
  defaultValues?: Record<string, any>;
}) {
  const form = useForm({
    defaultValues: {
      test: {
        operator: '_in',
        value: [],
        ...defaultValues,
      },
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: need to run on mount only
  const formSpy = useMemo(
    () => ({
      ...form,
      setValue: mocks.setValueMock,
    }),
    [],
  );

  return <FormProvider {...formSpy}>{children}</FormProvider>;
}

const mockPermissionsData = {
  config: {
    auth: {
      session: {
        accessToken: {
          customClaims: [{ key: 'Role', isSystemVariable: true }],
        },
      },
    },
  },
};

describe('RuleValueInput', () => {
  beforeEach(() => {
    mockPointerEvent();

    mockUseRuleGroupEditor.mockReturnValue({
      schema: 'public',
      table: 'users',
      disabled: false,
    });

    mockUseProject.mockReturnValue({
      project: { id: 'test-project-id' },
    });
  });

  it('should pass selected x-hasura-variables as string', async () => {
    mocks.useGetRolesPermissionsQuery.mockImplementation(() => ({
      data: mockPermissionsData,
      loading: false,
    }));

    render(
      <TestWrapper defaultValues={{ operator: '_in', value: [] }}>
        <RuleValueInput name="test" selectedTablePath="public.users" />
      </TestWrapper>,
    );
    const user = new TestUserEvent();

    const multiSelect = screen.getByPlaceholderText('Select options...');
    await user.click(multiSelect);
    await waitFor(() => {
      expect(screen.getByText('X-Hasura-User-Id')).toBeInTheDocument();
    });

    const allowedIdsOption = screen.getByText('X-Hasura-User-Id');
    await user.click(allowedIdsOption);
    expect(
      await screen.findByTestId('badge-X-Hasura-User-Id'),
    ).toBeInTheDocument();

    expect(mocks.setValueMock).toHaveBeenCalledWith(
      'test.value',
      'X-Hasura-User-Id',
      {
        shouldDirty: true,
      },
    );
  });

  it('should pass simple values as string array', async () => {
    mocks.useGetRolesPermissionsQuery.mockImplementation(() => ({
      data: mockPermissionsData,
      loading: false,
    }));

    render(
      <TestWrapper defaultValues={{ operator: '_in', value: [] }}>
        <RuleValueInput name="test" selectedTablePath="public.users" />
      </TestWrapper>,
    );
    const user = new TestUserEvent();

    const multiSelect = screen.getByPlaceholderText('Select options...');
    await user.click(multiSelect);
    await waitFor(() => {
      expect(screen.getByText('X-Hasura-Role')).toBeInTheDocument();
    });

    const allowedIdsOption = screen.getByText('X-Hasura-Role');
    await user.click(allowedIdsOption);

    expect(screen.getByTestId('badge-X-Hasura-Role')).toBeInTheDocument();
    mocks.setValueMock.mockClear();
    await user.type(
      screen.getByPlaceholderText('Select options...'),
      'my-variable{Enter}',
    );

    expect(
      screen.queryByTestId('badge-X-Hasura-User-Id'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('badge-my-variable')).toBeInTheDocument();

    expect(mocks.setValueMock).toHaveBeenCalledWith(
      'test.value',
      ['my-variable'],
      {
        shouldDirty: true,
      },
    );

    mocks.setValueMock.mockClear();
    await user.type(
      screen.getByPlaceholderText('Select options...'),
      'my-variable-2{Enter}',
    );

    expect(mocks.setValueMock).toHaveBeenCalledWith(
      'test.value',
      ['my-variable', 'my-variable-2'],
      {
        shouldDirty: true,
      },
    );
  });
});
