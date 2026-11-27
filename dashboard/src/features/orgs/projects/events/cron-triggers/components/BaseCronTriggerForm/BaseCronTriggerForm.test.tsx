import { Button } from '@/components/ui/v3/button';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  fireEvent,
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import BaseCronTriggerForm from './BaseCronTriggerForm';
import { defaultFormValues } from './BaseCronTriggerFormTypes';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

beforeAll(() => mockScrollIntoViewAndPointerCapture());

async function openForm(isEditing = false) {
  const user = new TestUserEvent();
  const onSubmit = vi.fn();
  render(
    <BaseCronTriggerForm
      isEditing={isEditing}
      initialData={{
        ...defaultFormValues,
        triggerName: 'nightly-webhook',
        webhook: 'https://example.com/webhook',
        schedule: '0 22 * * 1-5',
        payload: '{}',
      }}
      trigger={({ open }) => <Button onClick={open}>Open cron form</Button>}
      titleText={isEditing ? 'Edit Cron Trigger' : 'Create a New Cron Trigger'}
      descriptionText="Configure a recurring webhook."
      submitButtonText="Save trigger"
      onSubmit={onSubmit}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Open cron form' }));
  const dialog = within(await screen.findByRole('dialog'));
  const schedule = dialog.getByRole('textbox', {
    name: 'Schedule',
  });
  return { user, onSubmit, dialog, schedule };
}

describe('Cron Trigger schedule input', () => {
  it.each([false, true])(
    'uses the shared five-field editor and submits a preset (editing=%s)',
    async (isEditing) => {
      const { user, onSubmit, dialog, schedule } = await openForm(isEditing);
      expect(schedule).toHaveValue('0 22 * * 1-5');
      for (const field of ['Minute', 'Hour', 'Day', 'Month', 'Weekday']) {
        expect(dialog.getByText(field, { exact: true })).toBeInTheDocument();
      }
      expect(schedule).toHaveAccessibleDescription(/Schedules use UTC/);
      expect(
        dialog.queryByRole('button', { name: 'Every 10 seconds' }),
      ).not.toBeInTheDocument();
      await user.click(dialog.getByRole('button', { name: 'Every 5 minutes' }));
      expect(schedule).toHaveValue('*/5 * * * *');
      await user.click(dialog.getByRole('button', { name: 'Daily at 05:00' }));
      expect(schedule).toHaveValue('0 5 * * *');
      await user.click(dialog.getByRole('button', { name: 'Save trigger' }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            triggerName: 'nightly-webhook',
            webhook: 'https://example.com/webhook',
            schedule: '0 5 * * *',
            payload: '{}',
          }),
        ),
      );
    },
  );

  it('highlights the cron field at the cursor', async () => {
    const { user, dialog, schedule } = await openForm();
    await user.click(schedule);
    fireEvent.select(schedule, {
      target: { selectionStart: 3, selectionEnd: 3 },
    });
    expect(dialog.getByText('Hour', { exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(dialog.getByText('Minute', { exact: true })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows Hasura syntax help without pg_cron-only options', async () => {
    const { user, dialog } = await openForm();
    await user.click(
      dialog.getByRole('button', { name: 'Cron schedule help' }),
    );
    const help = within(
      await screen.findByRole('dialog', { name: 'Cron schedule help' }),
    );
    expect(help.getByText('Cron syntax')).toBeInTheDocument();
    expect(help.getByText(/Calendar schedules use UTC/)).toBeInTheDocument();
    expect(help.queryByText('$', { exact: true })).not.toBeInTheDocument();
    expect(help.queryByText('@reboot')).not.toBeInTheDocument();
    expect(help.queryByText('Seconds-based intervals')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Cron schedule help' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { name: 'Create a New Cron Trigger' }),
    ).toBeInTheDocument();
  });

  it('preserves schedule validation and focuses the invalid input', async () => {
    const { user, dialog, schedule, onSubmit } = await openForm();
    await user.clear(schedule);
    await user.click(dialog.getByRole('button', { name: 'Save trigger' }));
    expect(
      await dialog.findByText('Schedule (cron expression) required'),
    ).toBeInTheDocument();
    expect(schedule).toHaveAttribute('aria-invalid', 'true');
    expect(schedule).toHaveAccessibleDescription(
      /Schedule \(cron expression\) required/,
    );
    await waitFor(() => expect(schedule).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
