import type { ElevationMethod } from '@nhost/nhost-js/auth';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useState } from 'react';
import { vi } from 'vitest';
import { mockMatchMediaValue, mockSession } from '@/tests/mocks';
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
const user = userEvent.setup();

const elevationMethodsHandler = (
  response: { elevationRequired: boolean; methods: ElevationMethod[] } | null,
) =>
  http.get(`${AUTH_URL}/elevate`, () =>
    response
      ? HttpResponse.json(response)
      : HttpResponse.json({ message: 'boom' }, { status: 500 }),
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

  it('runs the action without prompting when elevation is not required', async () => {
    server.use(
      elevationMethodsHandler({ elevationRequired: false, methods: [] }),
    );
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await waitFor(() => expect(actionFn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('run')).toHaveTextContent('true');
  });

  it('aborts when elevation is required but the user has no method available', async () => {
    server.use(
      elevationMethodsHandler({ elevationRequired: true, methods: [] }),
    );
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await waitFor(() =>
      expect(
        screen.getByText(
          'Add a security key or set up an authenticator app before performing this action.',
        ),
      ).toBeInTheDocument(),
    );
    expect(actionFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('run')).toHaveTextContent('false');
  });

  it('aborts when the available methods cannot be fetched', async () => {
    server.use(elevationMethodsHandler(null));
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await waitFor(() =>
      expect(screen.getByTestId('run')).toHaveTextContent('false'),
    );
    expect(actionFn).not.toHaveBeenCalled();
  });

  it('elevates with the only available method without asking the user to pick one', async () => {
    server.use(
      elevationMethodsHandler({
        elevationRequired: true,
        methods: ['webauthn'],
      }),
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

  it('lets the user choose a method and elevates with a one-time password', async () => {
    const verifyOtp = vi.fn(() => HttpResponse.json({ session: mockSession }));

    server.use(
      elevationMethodsHandler({
        elevationRequired: true,
        methods: ['webauthn', 'totp'],
      }),
      http.post(`${AUTH_URL}/elevate/totp`, verifyOtp),
    );
    const actionFn = vi.fn().mockResolvedValue(undefined);

    render(<TestComponent actionFn={actionFn} />);
    screen.getByTestId('run').click();

    await user.click(await screen.findByText('Authenticator app'));
    await user.type(
      screen.getByPlaceholderText('Enter the 6-digit code'),
      '123456',
    );
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(actionFn).toHaveBeenCalledTimes(1));
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('run')).toHaveTextContent('true');
  });
});
