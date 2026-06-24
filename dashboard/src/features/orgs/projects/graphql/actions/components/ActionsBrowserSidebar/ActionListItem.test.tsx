import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue, mockRouter as baseRouter } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  createExportActionsMetadataHandler,
  sampleMutationAction,
} from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import ActionListItem from './ActionListItem';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

// Opening the Edit Action drawer mounts the action form, which pulls in the CodeMirror editor.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    readOnly,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer(
  createExportActionsMetadataHandler(),
  nhostGraphQLLink.query('getRemoteAppRoles', () =>
    HttpResponse.json({ data: { authRoles: [{ role: 'user' }] } }),
  ),
);

function mockRouter(actionSlug?: string) {
  mocks.useRouter.mockReturnValue({
    ...baseRouter,
    pathname:
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions/[actionSlug]',
    route:
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions/[actionSlug]',
    asPath: '/orgs/xyz/projects/test-project/graphql/actions',
    query: {
      orgSlug: 'xyz',
      appSubdomain: 'test-project',
      ...(actionSlug ? { actionSlug } : {}),
    },
  });
}

function renderItem(overrides?: { onDeleteAction?: () => void }) {
  const onDeleteAction = vi.fn();
  render(
    <ActionListItem
      action={sampleMutationAction}
      onDeleteAction={overrides?.onDeleteAction ?? onDeleteAction}
    />,
  );
  return { onDeleteAction };
}

describe('ActionListItem', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    queryClient.clear();
    mockRouter();
  });

  afterEach(() => server.resetHandlers());

  afterAll(() => server.close());

  it('links to the action detail page and highlights when selected', () => {
    mockRouter('login');
    renderItem();

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/orgs/xyz/projects/test-project/graphql/actions/login',
    );
    expect(screen.getByRole('link')).toHaveClass('text-primary-main');
  });

  it('does not highlight when a different action is selected', () => {
    mockRouter('getProfile');
    renderItem();

    expect(screen.getByRole('link')).not.toHaveClass('text-primary-main');
  });

  it('opens the edit drawer from the dropdown menu', async () => {
    const user = new TestUserEvent();
    renderItem();

    await user.click(screen.getByTestId('action-menu-login'));
    await user.click(await screen.findByText('Edit Action'));

    expect(
      await screen.findByRole('button', { name: 'Save' }),
    ).toBeInTheDocument();
  });

  it('invokes onDeleteAction from the dropdown menu', async () => {
    const user = new TestUserEvent();
    const { onDeleteAction } = renderItem();

    await user.click(screen.getByTestId('action-menu-login'));
    await user.click(await screen.findByText('Delete Action'));

    expect(onDeleteAction).toHaveBeenCalledWith(sampleMutationAction);
  });

  it('opens the permissions drawer from the dropdown menu', async () => {
    const user = new TestUserEvent();
    renderItem();

    await user.click(screen.getByTestId('action-menu-login'));
    await user.click(await screen.findByText('Edit Permissions'));

    expect(await screen.findByText(/Permissions for/)).toBeInTheDocument();
  });
});
