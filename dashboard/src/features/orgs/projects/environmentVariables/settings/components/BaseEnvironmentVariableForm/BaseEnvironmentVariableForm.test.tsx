import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { useDialog } from '@/components/common/DialogProvider';
import { mockRouter } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import type { DialogFormProps } from '@/types/common';
import BaseEnvironmentVariableForm, {
  type BaseEnvironmentVariableFormValues,
  baseEnvironmentVariableFormValidationSchema,
} from './BaseEnvironmentVariableForm';

function TestForm({
  mode,
  defaultValues,
  location,
}: DialogFormProps & {
  mode: 'create' | 'edit';
  defaultValues: BaseEnvironmentVariableFormValues;
}) {
  const form = useForm<BaseEnvironmentVariableFormValues>({
    defaultValues,
    resolver: yupResolver(baseEnvironmentVariableFormValidationSchema),
  });

  return (
    <FormProvider {...form}>
      <BaseEnvironmentVariableForm
        mode={mode}
        submitButtonText={mode === 'create' ? 'Create' : 'Save'}
        onSubmit={vi.fn()}
        location={location}
      />
    </FormProvider>
  );
}

function CreateDialogOpener() {
  const { openDialog } = useDialog();

  return (
    <button
      type="button"
      onClick={() =>
        openDialog({
          title: 'Create environment variable',
          component: (
            <TestForm
              mode="create"
              defaultValues={{ id: '', name: '', value: '' }}
            />
          ),
        })
      }
    >
      Open
    </button>
  );
}

// The mocked router doesn't navigate, so run the dialog provider's
// routeChangeStart listener the way Next.js would after the link is clicked.
function startNavigation() {
  const routeChangeStart = vi
    .mocked(mockRouter.events.on)
    .mock.calls.findLast(([event]) => event === 'routeChangeStart')?.[1];

  routeChangeStart?.('/orgs/xyz/projects/test-project/settings?tab=secrets', {
    shallow: false,
  });
}

beforeEach(() => {
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
});

describe('BaseEnvironmentVariableForm', () => {
  it('edit shows only the value', () => {
    render(
      <TestForm
        mode="edit"
        defaultValues={{ id: 'API_URL', name: 'API_URL', value: 'a' }}
      />,
    );

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('create shows an error when submitted without a name', async () => {
    const user = new TestUserEvent();
    render(
      <TestForm
        mode="create"
        defaultValues={{ id: '', name: '', value: '' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('Name is a required field'),
    ).toBeInTheDocument();
  });

  it('asks before the Secrets link discards typed input', async () => {
    const user = new TestUserEvent();
    render(<CreateDialogOpener />);

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.type(await screen.findByLabelText('Name'), 'API_KEY');
    await user.click(screen.getByRole('link', { name: 'Secrets' }));

    expect(startNavigation).toThrow('Unsaved changes');
    expect(
      await screen.findByRole('alertdialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('API_KEY');
  });

  it('closes an untouched dialog when the Secrets link is followed', async () => {
    const user = new TestUserEvent();
    render(<CreateDialogOpener />);

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(
      await screen.findByRole('dialog', {
        name: 'Create environment variable',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Secrets' }));
    startNavigation();

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Create environment variable' }),
      ).not.toBeInTheDocument();
    });
  });
});
