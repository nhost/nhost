import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StackLogos from '@/components/StackLogos';

describe('StackLogos', () => {
  // The marks are hidden from assistive technology, so each link has to say
  // where it goes itself.
  it('links each mark to its project by name', () => {
    const html = renderToStaticMarkup(<StackLogos />);

    expect(html).toMatch(/href="https:\/\/nhost\.io".*?>Nhost<\/span>/);
    expect(html).toMatch(/href="https:\/\/nextjs\.org".*?>Next\.js<\/span>/);
  });
});
