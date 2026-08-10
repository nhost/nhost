import type { PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { LogsFilterFormValues } from '@/features/orgs/projects/logs/components/LogsHeader';
import { mockApplication } from '@/tests/mocks';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { subMinutes } from 'date-fns';
import LogsRangeSelector from './LogsRangeSelector';

mockPointerEvent();

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

function Wrapper({
  children,
  defaultValues,
}: PropsWithChildren<{ defaultValues: Partial<LogsFilterFormValues> }>) {
  const form = useForm<LogsFilterFormValues>({
    defaultValues: {
      from: subMinutes(new Date(), 20).toISOString(),
      to: new Date().toISOString(),
      regexFilter: '',
      service: '__all__',
      interval: 20,
      ...defaultValues,
    },
  });

  return <FormProvider {...form}>{children}</FormProvider>;
}

describe('LogsRangeSelector', () => {
  it('should show "Live" on the trigger when "to" is null', () => {
    render(
      <Wrapper defaultValues={{ to: null }}>
        <LogsRangeSelector onSubmitFilterValues={vi.fn()} />
      </Wrapper>,
    );

    expect(screen.getByRole('button', { name: /live/i })).toBeInTheDocument();
  });

  it('should apply a selected interval and submit the form values', async () => {
    const onSubmitMock = vi.fn();
    const user = new TestUserEvent();
    render(
      <Wrapper defaultValues={{ interval: null }}>
        <LogsRangeSelector onSubmitFilterValues={onSubmitMock} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('Last 15 min'));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
    });
    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 15, to: expect.any(String) }),
    );
  });
});
