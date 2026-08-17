import { mockApplication } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import LogsHeader from './LogsHeader';

const server = setupServer(tokenQuery);

const mockServices = [
  'custom-templates-fetcher',
  'run-service',
  'functions',
  'grafana',
  'hasura',
  'hasura-auth',
  'hasura-graphi',
  'hasura-storage',
  'postgres',
  'job-backup',
];

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  value: vi.fn(() => ({
    width: 100,
    height: 40,
    top: 0,
    left: 0,
    bottom: 40,
    right: 100,
  })),
});

mockPointerEvent();

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

vi.mock('@/generated/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/generated/graphql');
  return {
    ...actual,
    useGetServiceLabelValuesQuery: () => ({
      data: { getServiceLabelValues: mockServices },
    }),
  };
});

describe('LogsHeader', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'staging';
    server.listen();
  });

  it('should call submit with any service', async () => {
    const onSubmitMock = vi.fn();
    const onRefetchMock = vi.fn();
    const user = new TestUserEvent();
    render(
      <LogsHeader
        loading={false}
        onSubmitFilterValues={onSubmitMock}
        onRefetch={onRefetchMock}
      />,
    );
    await TestUserEvent.fireClickEvent(
      await screen.findByTestId('ServicePicker')
    );

    const runBillingOption = await screen.findByRole('option', {
      name: 'run-service',
    });
    await user.click(runBillingOption);
    expect(await screen.findByTestId('ServicePicker')).toHaveTextContent(
      'run-service',
    );
    const regexInput = screen.getByPlaceholderText(
      'Search logs with a regular expression',
    );
    expect(regexInput).toBeInTheDocument();

    onSubmitMock.mockReset();

    await user.type(regexInput, 'Random text');
    fireEvent.submit(regexInput.closest('form')!);
    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
    });
    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        regexFilter: 'Random text',
        service: 'run-service',
      }),
    );
  });
});
