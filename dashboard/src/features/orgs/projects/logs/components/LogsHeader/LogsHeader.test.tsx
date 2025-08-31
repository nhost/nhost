import { mockApplication } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
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

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

vi.mock('@/utils/__generated__/graphql', async () => {
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
    const onRefetchMock = vi.fn();
    const user = new TestUserEvent();
    render(
      <LogsHeader
        loading={false}
        onSubmitFilterValues={onSubmitMock}
        onRefetch={onRefetchMock}
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

    onSubmitMock.mockReset();

    await user.type(regexInput, 'Random text{Enter}');
    expect(onSubmitMock).toHaveBeenCalledTimes(1);
    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        regexFilter: 'Random text',
        service: 'run-service',
      }),
    );
  });
});
