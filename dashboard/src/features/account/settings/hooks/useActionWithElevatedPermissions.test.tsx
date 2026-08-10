import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useState } from 'react';
import { vi } from 'vitest';
import { mockMatchMediaValue, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { render, screen, waitFor } from '@/tests/testUtils';
import useActionWithElevatedPermissions from './useActionWithElevatedPermissions';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

// startAuthentication wraps the browser WebAuthn API, which jsdom can't drive;
// mock it so the elevation flow can resolve. The network calls around it are
// mocked via MSW below.
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn().mockResolvedValue({ id: 'test-credential' }),
}));

const AUTH_URL = 'https://local.auth.local.nhost.run/v1';

const server = setupServer();

const securityKeysHandler = (
  keys: Array<{ id: string; nickname: string | null }> | null,
) =>
  nhostGraphQLLink.query('securityKeys', () =>
    HttpResponse.json(
      keys
        ? { data: { authUserSecurityKeys: keys } }
        : { errors: [{ message: 'boom' }] },
    ),
  );

function TestComponent({
  actionFn,
}: {
  actionFn: (...args: unknown[]) => Promise<unknown>;
}) {
  const [result, setResult] = useState<string>('idle');
  const run = useActionWithElevatedPermissions({
    actionFn,
    successMessage: 'done',
  });

  return (
    <button
      type="button"
      onClick={async () => setResult(String(await run()))}
      data-testid="run"
    >
      {result}
    </button>
  );
}

describe('useActionWithElevatedPermissions', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('runs the action without elevation when the user has no security keys', async () => {
    server.use(securityKeysHandler([]));
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await waitFor(() => expect(actionFn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('run')).toHaveTextContent('true');
  });

  it('does not elevate and surfaces an error when the security-keys count is indeterminate', async () => {
    // Query errors -> data undefined, and the in-hook refetch hits the same
    // failing handler. The action must abort instead of firing a WebAuthn
    // challenge or silently skipping elevation.
    server.use(securityKeysHandler(null));
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await waitFor(() =>
      expect(
        screen.getByText(
          'Could not verify your security settings. Please try again.',
        ),
      ).toBeInTheDocument(),
    );
    expect(actionFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('run')).toHaveTextContent('false');
  });

  it('recovers via refetch when the initial security-keys query failed', async () => {
    // Initial load errors (data undefined), then the in-hook refetch succeeds
    // with no keys -> the action proceeds without elevation.
    server.use(
      nhostGraphQLLink.query(
        'securityKeys',
        () => HttpResponse.json({ errors: [{ message: 'boom' }] }),
        { once: true },
      ),
      securityKeysHandler([]),
    );
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await waitFor(() => expect(actionFn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('run')).toHaveTextContent('true');
  });

  it('elevates and runs the action when the user has security keys', async () => {
    server.use(
      securityKeysHandler([{ id: 'key-1', nickname: 'My key' }]),
      http.post(`${AUTH_URL}/elevate/webauthn`, () => HttpResponse.json({})),
      http.post(`${AUTH_URL}/elevate/webauthn/verify`, () =>
        HttpResponse.json({ session: mockSession }),
      ),
    );
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await waitFor(() => expect(actionFn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('run')).toHaveTextContent('true');
  });
});
