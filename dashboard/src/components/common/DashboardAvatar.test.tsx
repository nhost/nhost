import { act, render, screen, waitFor } from '@/tests/testUtils';
import DashboardAvatar from './DashboardAvatar';

const images: HTMLImageElement[] = [];

function loadImage(image: HTMLImageElement) {
  Object.defineProperties(image, {
    complete: { value: true },
    naturalWidth: { value: 80 },
  });
  image.dispatchEvent(new Event('load'));
}

beforeEach(() => {
  images.length = 0;
  vi.spyOn(window, 'Image').mockImplementation(function createImage() {
    const image = document.createElement('img');
    images.push(image);
    return image;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DashboardAvatar', () => {
  it.each([
    ['Rui Almeida', undefined, 'RA'],
    ['  rui   almeida  ', undefined, 'RA'],
    ['Rui de Almeida', undefined, 'RA'],
    ['Rui', undefined, 'R'],
    ['', 'rui@example.com', 'R'],
    ['   ', '  rui@example.com  ', 'R'],
    [undefined, 'rui@example.com', 'R'],
    ['山田 太郎', undefined, '山太'],
    ['👩🏽‍💻 Developer', undefined, '👩🏽‍💻D'],
  ])('shows initials for %s / %s', (name, email, initials) => {
    render(<DashboardAvatar name={name} email={email} />);

    expect(screen.getByText(initials)).toBeInTheDocument();
  });

  it('shows a person when both name and email are missing', () => {
    render(<DashboardAvatar name=" " email=" " />);

    expect(screen.getByRole('img', { name: 'User' })).toBeInTheDocument();
  });

  it.each([
    'https://www.gravatar.com/avatar/hash?d=blank&r=g&s=80',
    'https://secure.gravatar.com/avatar/hash?default=blank&f=y',
    'https://gravatar.com/avatar/hash?default=retro&forcedefault=y',
  ])('requests an error instead of a default image for %s', (src) => {
    render(<DashboardAvatar name="Rui Almeida" src={src} />);

    const url = new URL(images[0].src);
    expect(url.searchParams.get('d')).toBe('404');
    expect(url.searchParams.has('default')).toBe(false);
    expect(url.searchParams.has('f')).toBe(false);
    expect(url.searchParams.has('forcedefault')).toBe(false);
    expect(url.searchParams.get('r')).toBe(new URL(src).searchParams.get('r'));
    expect(url.searchParams.get('s')).toBe(new URL(src).searchParams.get('s'));
  });

  it.each([
    'https://avatars.githubusercontent.com/u/123?v=4',
    'https://example.com/avatar/photo.png?d=blank',
    'https://gravatar.com.example.com/avatar/hash?d=blank',
    '/photo.png',
  ])('leaves non-Gravatar sources unchanged for %s', (src) => {
    render(<DashboardAvatar name="Rui Almeida" src={src} />);

    expect(images[0].getAttribute('src')).toBe(src);
  });

  it.each([
    'https://www.gravatar.com/avatar/hash?d=blank',
    'https://avatars.githubusercontent.com/u/123?v=4',
  ])('keeps real photos for %s', async (src) => {
    render(<DashboardAvatar name="Rui Almeida" src={src} />);

    act(() => loadImage(images[0]));

    expect(
      await screen.findByRole('img', { name: 'Rui Almeida' }),
    ).toHaveAttribute('src', images[0].src);
    expect(screen.queryByText('RA')).not.toBeInTheDocument();
  });

  it('shows initials when a photo fails and loads a replacement photo', async () => {
    const { rerender } = render(
      <DashboardAvatar
        name="Rui Almeida"
        src="https://www.gravatar.com/avatar/hash?d=blank"
      />,
    );

    act(() => images[0].dispatchEvent(new Event('error')));
    expect(screen.getByText('RA')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    rerender(
      <DashboardAvatar
        name="Jane Doe"
        src="https://avatars.githubusercontent.com/u/123"
      />,
    );
    act(() => loadImage(images[1]));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toBeInTheDocument();
      expect(screen.queryByText('JD')).not.toBeInTheDocument();
    });
  });
});
