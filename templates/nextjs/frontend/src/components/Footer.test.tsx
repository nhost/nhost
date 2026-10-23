import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Footer from '@/components/Footer';

describe('Footer', () => {
  it('links to the Nhost docs beside the backend status', () => {
    const html = renderToStaticMarkup(<Footer />);

    expect(html).toContain('href="https://docs.nhost.io"');
    expect(html).toContain('Nhost Local');
  });
});
