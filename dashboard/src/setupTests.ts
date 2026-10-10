import '@testing-library/jest-dom/extend-expect';
import matchers from '@testing-library/jest-dom/matchers';
import { fetch, Headers, Request, Response } from 'undici';
import { expect, vi } from 'vitest';

// Restore Node.js native fetch (powered by undici)
Object.assign(global, {
  fetch,
  Headers,
  Request,
  Response,
});

// Mock the ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Stub the global ResizeObserver
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Many tests replace `@uiw/react-codemirror` with a bare stub, which breaks
// this module's top-level `Prec`/`EditorView` calls. The theme is purely
// visual, so tests get an empty extension instead.
vi.mock('@/lib/codeMirrorAppTheme', () => ({ codeMirrorAppBackground: [] }));

expect.extend(matchers);
