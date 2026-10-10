import { renderToString } from 'react-dom/server';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

function Probe({ initialValue }: { initialValue?: boolean }) {
  const isDesktop = useMediaQuery('md', { initialValue });
  return <span>{isDesktop ? 'desktop' : 'mobile'}</span>;
}

describe('useMediaQuery', () => {
  it('renders the initial value on the server', () => {
    expect(renderToString(<Probe />)).toContain('mobile');
    expect(renderToString(<Probe initialValue />)).toContain('desktop');
  });

  it('switches to the viewport once it is known', async () => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);

    render(<Probe initialValue />);

    expect(await screen.findByText('mobile')).toBeInTheDocument();
  });
});
