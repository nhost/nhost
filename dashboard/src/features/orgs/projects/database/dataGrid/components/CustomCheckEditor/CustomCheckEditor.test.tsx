import { yupResolver } from '@hookform/resolvers/yup';
import { setupServer } from 'msw/node';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import * as Yup from 'yup';
import { filterValidationSchema } from '@/features/orgs/projects/common/utils/permissions/validationSchemas/basePermissionValidationSchema';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  ConditionNode,
  GroupNode,
  LogicalOperator,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';
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
import CustomCheckEditor from './CustomCheckEditor';
import {
  type CustomCheckEditorMode,
  CustomCheckModeProvider,
} from './CustomCheckModeProvider';
import CustomCheckModeToggle from './CustomCheckModeToggle';

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

function condition(
  column: string,
  operator: HasuraOperator = '_eq',
  value: unknown = null,
): ConditionNode {
  return {
    type: 'condition',
    id: crypto.randomUUID(),
    column,
    operator,
    value,
  };
}

function group(operator: LogicalOperator, children: RuleNode[]): GroupNode {
  return {
    type: 'group',
    id: crypto.randomUUID(),
    operator,
    children,
  };
}

function TestWrapper({
  children,
  defaultValues,
  mode = 'builder',
  withValidation = false,
}: {
  children: React.ReactNode;
  defaultValues: Record<string, unknown>;
  mode?: CustomCheckEditorMode;
  withValidation?: boolean;
}) {
  const form = useForm({
    defaultValues,
    resolver: withValidation
      ? yupResolver(Yup.object({ rule: filterValidationSchema }))
      : undefined,
  });
  return (
    <FormProvider {...form}>
      <CustomCheckModeProvider defaultMode={mode}>
        {mode === 'json' && withValidation ? (
          <button type="button" onClick={() => form.trigger()}>
            validate
          </button>
        ) : null}
        {children}
      </CustomCheckModeProvider>
    </FormProvider>
  );
}

const defaultProps = {
  schema: 'public',
  table: 'books',
  name: 'rule',
};

function HarnessWithToggle() {
  return (
    <>
      <CustomCheckModeToggle />
      <CustomCheckEditor {...defaultProps} />
    </>
  );
}

describe('CustomCheckEditor', () => {
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

  describe('mode switch', () => {
    it('renders only the builder when mode is "builder"', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_implicit', [condition('title', '_eq', 'foo')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('renders only the JSON editor when mode is "json"', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_implicit', [condition('title', '_eq', 'foo')]),
          }}
          mode="json"
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.queryByText('title')).not.toBeInTheDocument();
    });
  });

  describe('json editor errors', () => {
    it('typing malformed JSON shows "Invalid JSON"', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_implicit', [condition('title', '_eq', 'foo')]),
          }}
          mode="json"
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await TestUserEvent.fireTypeEvent(textarea, '{not valid json');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON');
      });
    });

    it('typing a JSON array shows "Rule must be a JSON object"', async () => {
      render(
        <TestWrapper
          defaultValues={{ rule: group('_implicit', []) }}
          mode="json"
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const user = new TestUserEvent();
      await user.clear(textarea);
      await user.paste('[1,2,3]');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Rule must be a JSON object',
        );
      });
    });

    it('typing a JSON primitive shows "Rule must be a JSON object"', async () => {
      render(
        <TestWrapper
          defaultValues={{ rule: group('_implicit', []) }}
          mode="json"
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const user = new TestUserEvent();
      await user.clear(textarea);
      await user.paste('123');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Rule must be a JSON object',
        );
      });
    });

    it('clears the error once input becomes valid again', async () => {
      render(
        <TestWrapper
          defaultValues={{ rule: group('_implicit', []) }}
          mode="json"
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const user = new TestUserEvent();
      await user.clear(textarea);
      await user.paste('{bad');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON');
      });

      await user.clear(textarea);
      await user.paste('{"title":{"_eq":"foo"}}');

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('applies destructive border styling while an error is shown', async () => {
      render(
        <TestWrapper
          defaultValues={{ rule: group('_implicit', []) }}
          mode="json"
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const user = new TestUserEvent();
      await user.clear(textarea);
      await user.paste('{bad');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(textarea.className).toContain('border-destructive');
    });

    it('surfaces an invalid-node yup error for a primitive value at a column key', async () => {
      render(
        <TestWrapper
          defaultValues={{ rule: group('_implicit', []) }}
          mode="json"
          withValidation
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const user = new TestUserEvent();
      await user.clear(textarea);
      await user.paste('{"user_id":5}');
      await user.click(screen.getByRole('button', { name: 'validate' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /"user_id" has a primitive value/,
        );
      });
    });

    it('surfaces an invalid-node yup error for an array at a non-_and/_or key', async () => {
      render(
        <TestWrapper
          defaultValues={{ rule: group('_implicit', []) }}
          mode="json"
          withValidation
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const user = new TestUserEvent();
      await user.clear(textarea);
      await user.paste('{"_ad":[{"col":{"_eq":"a"}}]}');
      await user.click(screen.getByRole('button', { name: 'validate' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /"_ad" is not a valid operator/,
        );
      });
    });
  });

  describe('cross-mode sync', () => {
    it('a builder edit is reflected in the JSON editor after switching mode', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_implicit', [condition('title', '_eq', 'foo')]),
          }}
        >
          <HarnessWithToggle />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(screen.getByText('Add'));
      await user.click(
        await screen.findByRole('option', { name: /release_date/ }),
      );

      expect(await screen.findByText('release_date')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /json/i }));

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(JSON.parse(textarea.value)).toEqual({
        title: { _eq: 'foo' },
        release_date: { _eq: null },
      });
    });

    it('a JSON edit is reflected in the builder after switching mode', async () => {
      render(
        <TestWrapper
          defaultValues={{ rule: group('_implicit', []) }}
          mode="json"
        >
          <HarnessWithToggle />
        </TestWrapper>,
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const user = new TestUserEvent();
      await user.clear(textarea);
      await user.paste(
        '{"_and":[{"title":{"_eq":"foo"}},{"release_date":{"_gt":"2020-01-01"}}]}',
      );

      await user.click(screen.getByRole('button', { name: /visual/i }));

      expect(await screen.findByText('AND')).toBeInTheDocument();
      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('_gt')).toBeInTheDocument();
    });
  });
});
