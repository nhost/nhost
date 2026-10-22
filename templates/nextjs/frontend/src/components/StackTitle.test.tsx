import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StackTitle from '@/components/StackTitle';

describe('StackTitle', () => {
  // The marks are hidden from assistive technology, so each link has to say
  // where it goes itself.
  it('links each mark to its project by name', () => {
    const html = renderToStaticMarkup(<StackTitle />);

    expect(html).toMatch(/href="https:\/\/nhost\.io".*?>Nhost<\/span>/);
    expect(html).toMatch(/href="https:\/\/nextjs\.org".*?>Next\.js<\/span>/);
  });

  // The grid drops the spaces between the heading's spans from the layout,
  // but they have to stay in its text for it to read as words.
  it('titles the page with both names', () => {
    const html = renderToStaticMarkup(<StackTitle />);
    const heading = /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? '';

    expect(heading.replace(/<[^>]+>/g, '')).toBe('Nhost + Next.js');
  });
});
