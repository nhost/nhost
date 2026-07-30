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
});
