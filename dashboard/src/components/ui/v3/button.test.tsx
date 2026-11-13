import { Button } from '@/components/ui/v3/button';
import { render, screen } from '@/tests/testUtils';

describe('Button', () => {
  it('defaults native buttons to type="button" and small size', () => {
    render(
      <form>
        <Button>Cancel</Button>
      </form>,
    );

    const button = screen.getByRole('button', { name: 'Cancel' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('h-11', 'md:h-9', 'px-3');
  });

  it('preserves explicit native button types', () => {
    render(<Button type="submit">Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('supports the medium size variant', () => {
    render(<Button size="md">Medium</Button>);

    expect(screen.getByRole('button', { name: 'Medium' })).toHaveClass(
      'h-11',
      'md:h-10',
      'px-4',
    );
  });

  it('supports the inline size variant without a fixed height', () => {
    render(
      <Button variant="link" size="inline">
        Inline
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Inline' });

    expect(button.className).not.toMatch(/(^|\s)(md:)?h-\d/);
    expect(button.className).not.toMatch(/(^|\s)px-\d/);
  });

  it('does not add a default type to asChild elements', () => {
    render(
      <Button asChild>
        <span>Docs</span>
      </Button>,
    );

    expect(screen.getByText('Docs')).not.toHaveAttribute('type');
  });
});
