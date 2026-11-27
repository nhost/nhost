import { Avatar } from '@/components/ui/v3/avatar';
import { render, screen } from '@/tests/testUtils';

describe('Avatar', () => {
  it('uses the first grapheme from the name as fallback text', () => {
    render(<Avatar name="Jane Doe" />);

    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('supports non-western names', () => {
    render(<Avatar name="山田 太郎" />);

    expect(screen.getByText('山')).toBeInTheDocument();
  });

  it('keeps emoji graphemes intact', () => {
    render(<Avatar name="👩🏽‍💻 Developer" />);

    expect(screen.getByText('👩🏽‍💻')).toBeInTheDocument();
  });

  it('prefers explicit fallback content', () => {
    render(<Avatar name="Jane Doe" fallback="JD" />);

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('picks a stable color from the full name, not just the initials', () => {
    render(
      <>
        <Avatar name="Jane Doe" fallback="JD" />
        <Avatar name=" jane doe " fallback="JD" />
        <Avatar name="John Doe" fallback="JD" />
      </>,
    );

    const [jane, sameJane, john] = screen.getAllByText('JD');
    expect(jane).not.toHaveClass('bg-grey-500');
    expect(jane).not.toHaveClass('dark:bg-muted');
    expect(jane.className).toBe(sameJane.className);
    expect(jane.className).not.toBe(john.className);
  });

  it('keeps the neutral background when no name is available', () => {
    render(<Avatar fallback="?" />);

    expect(screen.getByText('?')).toHaveClass('bg-grey-500', 'dark:bg-muted');
  });
});
