import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue, mockRouter as baseRouter } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { createExportActionsMetadataHandler } from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import NoActionsEmptyState from './NoActionsEmptyState';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

// Opening the Create Action drawer mounts the action form, which pulls in the CodeMirror editor.
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

function mockRouter() {
  mocks.useRouter.mockReturnValue({
    ...baseRouter,
    pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
    route: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
    asPath: '/orgs/xyz/projects/test-project/graphql/actions',
  });
}

describe('NoActionsEmptyState', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    queryClient.clear();
    mockRouter();
  });

  afterEach(() => server.resetHandlers());

  afterAll(() => server.close());

  it('renders the default title and description', () => {
    render(<NoActionsEmptyState />);

    expect(screen.getByText('Create your first action')).toBeInTheDocument();
    expect(
      screen.getByText(/extend your GraphQL API with custom business logic/i),
    ).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(
      <NoActionsEmptyState
        title="Actions"
        description="Select an action from the sidebar, or create a new one."
      />,
    );

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Select an action from the sidebar, or create a new one.',
      ),
    ).toBeInTheDocument();
  });

  it('links to the GraphQL docs in a new tab', () => {
    render(<NoActionsEmptyState />);

    const link = screen.getByRole('link', {
      name: /learn more about the graphql api/i,
    });

    expect(link).toHaveAttribute(
      'href',
      'https://docs.nhost.io/products/graphql',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens the create action drawer from the New Action button', async () => {
    const user = new TestUserEvent();
    render(<NoActionsEmptyState />);

    await user.click(screen.getByRole('button', { name: /new action/i }));

    expect(
      await screen.findByRole('button', { name: 'Create' }),
    ).toBeInTheDocument();
  });
});
