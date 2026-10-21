// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ReplacePageLayout, {
  useReplacePage,
} from '@/components/ReplacePageLayout';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Done() {
  return <p>Done</p>;
}

function Page() {
  const replacePage = useReplacePage();
  return (
    <button type="button" onClick={() => replacePage(<Done />)}>
      Finish
    </button>
  );
}

describe('replace page layout', () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the page until something replaces it', () => {
    const html = renderToStaticMarkup(
      <ReplacePageLayout>
        <p>The page</p>
      </ReplacePageLayout>,
    );

    expect(html).toBe('<p>The page</p>');
  });

  it('keeps what replaced the page while the page under it changes', async () => {
    await act(async () =>
      root.render(
        <ReplacePageLayout>
          <Page />
        </ReplacePageLayout>,
      ),
    );

    await act(async () => container.querySelector('button')?.click());

    expect(container.textContent).toBe('Done');

    await act(async () =>
      root.render(
        <ReplacePageLayout>
          <p>Another page</p>
        </ReplacePageLayout>,
      ),
    );

    expect(container.textContent).toBe('Done');
  });
});
