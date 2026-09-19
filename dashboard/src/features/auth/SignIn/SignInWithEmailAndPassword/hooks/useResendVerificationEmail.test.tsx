import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import useResendVerificationEmail from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useResendVerificationEmail';
import { act, fireEvent, render, screen } from '@/tests/testUtils';

const AUTH_URL = 'https://local.auth.local.nhost.run/v1';
const RESEND_URL = `${AUTH_URL}/user/email/send-verification-email`;
const EMAIL = 'person@example.com';
const UNNORMALIZED_EMAIL = '  Person@Example.COM  ';
const NOW = new Date('2026-06-26T12:00:00.000Z');

let resendRequest: Promise<void> | undefined;

const server = setupServer(http.post(RESEND_URL, () => HttpResponse.json({})));

interface TestHarnessProps {
  email: string;
}

function TestHarness({ email }: TestHarnessProps) {
  const { resendVerificationEmail, loading, secondsRemaining } =
    useResendVerificationEmail(email);

  return (
    <>
      <button
        type="button"
        disabled={loading || secondsRemaining > 0}
        onClick={() => {
          resendRequest = resendVerificationEmail(email);
        }}
      >
        Resend
      </button>
      <span>Loading: {loading ? 'yes' : 'no'}</span>
      <span>Seconds remaining: {secondsRemaining}</span>
    </>
  );
}

async function finishResend(): Promise<void> {
  if (!resendRequest) {
    throw new Error('Expected a resend request to be started');
  }

  await act(async () => {
    await resendRequest;
  });
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  server.listen();
});

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  toast.remove();
  resendRequest = undefined;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});

afterAll(() => server.close());

describe('useResendVerificationEmail', () => {
  it('writes a normalized cooldown that counts down and re-enables the control', async () => {
    render(<TestHarness email={UNNORMALIZED_EMAIL} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));

    await finishResend();

    expect(
      window.sessionStorage.getItem('nhost_resend_cooldown:person@example.com'),
    ).toBe(String(NOW.getTime() + 62_000));
    expect(screen.getByText('Seconds remaining: 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Seconds remaining: 59')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(59_000);
    });

    expect(screen.getByText('Seconds remaining: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeEnabled();
  });

  it('loads a persisted cooldown using a normalized email key on mount', () => {
    window.sessionStorage.setItem(
      'nhost_resend_cooldown:person@example.com',
      String(NOW.getTime() + 30_000),
    );

    render(<TestHarness email=" Person@Example.COM " />);

    expect(screen.getByText('Seconds remaining: 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled();
  });

  it('shows the rate-limit toast, starts a cooldown, and resets loading on 429', async () => {
    server.use(
      http.post(RESEND_URL, () => new HttpResponse(null, { status: 429 })),
    );
    render(<TestHarness email={EMAIL} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));

    expect(screen.getByText('Loading: yes')).toBeInTheDocument();
    await finishResend();

    expect(
      screen.getByText(
        'Too many verification emails requested. Please wait a moment before trying again, and check your spam folder in the meantime.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Loading: no')).toBeInTheDocument();
    expect(screen.getByText('Seconds remaining: 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled();
  });

  it('shows the generic toast without starting a cooldown on a 500 response', async () => {
    const serverErrorHandler = vi.fn(() =>
      HttpResponse.json({ message: 'failure' }, { status: 500 }),
    );
    server.use(http.post(RESEND_URL, serverErrorHandler));
    render(<TestHarness email={EMAIL} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));

    expect(screen.getByText('Loading: yes')).toBeInTheDocument();
    await finishResend();

    expect(serverErrorHandler).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        'An error occurred while sending the verification email. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Loading: no')).toBeInTheDocument();
    expect(screen.getByText('Seconds remaining: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeEnabled();
  });
});
