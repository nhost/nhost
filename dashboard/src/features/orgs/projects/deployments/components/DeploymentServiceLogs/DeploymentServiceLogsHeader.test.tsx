import { setupServer } from 'msw/node';
import { vi } from 'vitest';
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

mockPointerEvent();

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

describe('DeploymentServiceLogsHeader', () => {
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
    await TestUserEvent.fireClickEvent(
      await screen.findByTestId('ServicePicker'),
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
      expect.anything(),
    );
  });
});
