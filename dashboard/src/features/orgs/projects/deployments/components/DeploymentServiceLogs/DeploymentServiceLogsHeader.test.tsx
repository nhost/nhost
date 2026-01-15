import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockApplication } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import DeploymentServiceLogsHeader from './DeploymentServiceLogsHeader';

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

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
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
    const user = new TestUserEvent();
    render(
      <DeploymentServiceLogsHeader
        loading={false}
        from="2025-08-31T14:23:04.039Z"
        to={null}
        onSubmit={onSubmitMock}
      />,
    );
    waitFor(() => {
      expect(screen.getByTestId('ServicePicker')).toBeInTheDocument();
    });
    waitFor(async () => {
      await user.click(await screen.findByTestId('ServicePicker'));
    });

    waitFor(async () => {
      expect(screen.getByText('run-service')).toBeInTheDocument();
    });
    const runBillingOption = await screen.findByText('run-service');
    await user.click(runBillingOption);
    expect(await screen.findByTestId('ServicePicker')).toHaveTextContent(
      'run-service',
    );
    const regexInput = screen.getByPlaceholderText(
      'Filter logs with a regular expression',
    );
    expect(regexInput).toBeInTheDocument();

    onSubmitMock.mockRestore();

    await user.type(regexInput, 'Random text');
    await user.click(screen.getByText('Search'));
    expect(onSubmitMock).toHaveBeenCalledTimes(1);
  });
});
