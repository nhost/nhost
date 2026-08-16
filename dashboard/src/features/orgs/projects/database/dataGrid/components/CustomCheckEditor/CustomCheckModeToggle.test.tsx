import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { CustomCheckModeProvider } from './CustomCheckModeProvider';
import CustomCheckModeToggle from './CustomCheckModeToggle';

describe('CustomCheckModeToggle', () => {
  it('renders the "Edit as:" label and both mode buttons', () => {
    render(
      <CustomCheckModeProvider>
        <CustomCheckModeToggle />
      </CustomCheckModeProvider>,
    );

    expect(screen.getByText('Edit as:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visual' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'JSON' })).toBeInTheDocument();
  });

  it('marks the default mode (builder) with aria-pressed="true"', () => {
    render(
      <CustomCheckModeProvider>
        <CustomCheckModeToggle />
      </CustomCheckModeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'JSON' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('respects the provider defaultMode', () => {
    render(
      <CustomCheckModeProvider defaultMode="json">
        <CustomCheckModeToggle />
      </CustomCheckModeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'JSON' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('updates the active mode when a button is clicked', async () => {
    render(
      <CustomCheckModeProvider>
        <CustomCheckModeToggle />
      </CustomCheckModeProvider>,
    );

    const user = new TestUserEvent();
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    expect(screen.getByRole('button', { name: 'JSON' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('keeps a supplied mode authoritative and requests controlled changes', async () => {
    const onModeChange = vi.fn();
    const { rerender } = render(
      <CustomCheckModeProvider mode="builder" onModeChange={onModeChange}>
        <CustomCheckModeToggle />
      </CustomCheckModeProvider>,
    );

    const user = new TestUserEvent();
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    expect(onModeChange).toHaveBeenCalledOnce();
    expect(onModeChange).toHaveBeenCalledWith('json');
    expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    rerender(
      <CustomCheckModeProvider mode="json" onModeChange={onModeChange}>
        <CustomCheckModeToggle />
      </CustomCheckModeProvider>,
    );

    expect(screen.getByRole('button', { name: 'JSON' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('keeps a disabled mode visible and does not request a mode change', async () => {
    const onModeChange = vi.fn();
    render(
      <CustomCheckModeProvider mode="json" onModeChange={onModeChange}>
        <CustomCheckModeToggle
          disabledModes={{
            builder: 'This filter can only be edited as JSON.',
          }}
        />
      </CustomCheckModeProvider>,
    );

    const visualButton = screen.getByRole('button', { name: 'Visual' });
    expect(visualButton).toBeDisabled();
    expect(visualButton).toHaveAccessibleDescription(
      'This filter can only be edited as JSON.',
    );

    const user = new TestUserEvent();
    await user.click(visualButton);

    expect(onModeChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'JSON' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
