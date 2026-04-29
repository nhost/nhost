import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import FunctionLogsTab from './FunctionLogsTab';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useFunctionLogs: vi.fn(),
}));

vi.mock(
  '@/features/orgs/projects/serverless-functions/hooks/useFunctionLogs',
  () => ({
    __esModule: true,
    default: mocks.useFunctionLogs,
    useFunctionLogs: mocks.useFunctionLogs,
  }),
);

const fn = {
  path: 'functions/hello.ts',
  route: '/hello',
  runtime: 'nodejs22.x',
  functionName: 'hello',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

beforeEach(() => {
  mocks.useFunctionLogs.mockReturnValue({
    data: undefined,
    loading: false,
    error: undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FunctionLogsTab', () => {
  it('passes the function route as `path` to useFunctionLogs', () => {
    render(<FunctionLogsTab fn={fn} />);

    expect(mocks.useFunctionLogs).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/hello', regexFilter: '' }),
    );
  });

  it('re-invokes useFunctionLogs with the new regex filter when the form is submitted', async () => {
    render(<FunctionLogsTab fn={fn} />);

    const user = new TestUserEvent();
    await user.type(
      screen.getByPlaceholderText('Filter logs with a regular expression'),
      '(?i)error',
    );

    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mocks.useFunctionLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          path: '/hello',
          regexFilter: '(?i)error',
        }),
      );
    });
  });
});
