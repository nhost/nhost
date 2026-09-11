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

// Ensure localStorage is fully functional in jsdom / modern Node environments
if (
  typeof window !== 'undefined' &&
  (!window.localStorage || typeof window.localStorage.clear !== 'function')
) {
  class MockStorage implements Storage {
    private store = new Map<string, string>();

    get length() {
      return this.store.size;
    }

    clear(): void {
      this.store.clear();
    }

    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null;
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }
  }

  const mockStorage = new MockStorage();
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}

expect.extend(matchers);
