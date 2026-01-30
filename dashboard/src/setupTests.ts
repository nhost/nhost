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
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Stub the global ResizeObserver
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

expect.extend(matchers);
