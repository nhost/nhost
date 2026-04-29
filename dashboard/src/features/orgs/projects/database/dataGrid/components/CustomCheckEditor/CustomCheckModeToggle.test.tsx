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
});
