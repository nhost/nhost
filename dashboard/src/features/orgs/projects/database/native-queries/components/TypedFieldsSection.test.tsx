import { vi } from 'vitest';
import TypedFieldsSection from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

describe('TypedFieldsSection', () => {
  it('renders labels, rows, Add behavior, and array errors in contained mode', async () => {
    const onAdd = vi.fn();
    render(
      <TypedFieldsSection
        label="Fields"
        addLabel="Add field"
        layout="contained"
        error="Add at least one field."
        onAdd={onAdd}
      >
        <div data-testid="typed-row">Row</div>
      </TypedFieldsSection>,
    );

    const section = screen.getByRole('region', { name: 'Fields' });
    const rows = screen.getByTestId('typed-row').parentElement;

    expect(section).toHaveAttribute('data-layout', 'contained');
    expect(section).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(rows).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(screen.getByText('Add at least one field.')).toBeInTheDocument();

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Add field' }),
    );
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('keeps argument rows in normal document flow', () => {
    render(
      <TypedFieldsSection
        label="Arguments"
        addLabel="Add argument"
        layout="flow"
        onAdd={vi.fn()}
      >
        <div data-testid="argument-row">Row</div>
      </TypedFieldsSection>,
    );

    const section = screen.getByRole('region', { name: 'Arguments' });
    const rows = screen.getByTestId('argument-row').parentElement;

    expect(section).toHaveAttribute('data-layout', 'flow');
    expect(section).toHaveClass('space-y-3');
    expect(section).not.toHaveClass('flex-1');
    expect(rows).not.toHaveClass('overflow-y-auto', 'flex-1');
    expect(
      screen.getByRole('button', { name: 'Add argument' }),
    ).toBeInTheDocument();
  });
});
