import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  DEFAULT_SEGMENT_WRITE_KEY,
  getCookieDomain,
  getSegmentWriteKey,
  trackCodeCopy,
  trackPageFeedback,
  trackPageview,
  trackSearchQuery,
  trackSearchResultClick,
} from './analytics.ts';

interface GlobalScopeWithWindow {
  window?: {
    location: {
      hostname: string;
      pathname: string;
    };
    analytics?: {
      page: (props?: Record<string, unknown>) => void;
      track: (event: string, properties?: Record<string, unknown>) => void;
    };
  };
  document?: {
    title: string;
  };
}

const testGlobal = globalThis as unknown as GlobalScopeWithWindow;

describe('analytics utilities', () => {
  let trackedEvents: Array<{ event: string; properties?: unknown }>;
  let pageviews: Array<unknown>;

  beforeEach(() => {
    trackedEvents = [];
    pageviews = [];

    testGlobal.window = {
      location: {
        hostname: 'docs.nhost.io',
        pathname: '/getting-started',
      },
      analytics: {
        page: (props?: Record<string, unknown>) => pageviews.push(props),
        track: (event: string, properties?: Record<string, unknown>) =>
          trackedEvents.push({ event, properties }),
      },
    };

    testGlobal.document = {
      title: 'Documentation Title',
    };
  });

  afterEach(() => {
    delete testGlobal.window;
    delete testGlobal.document;
  });

  describe('getSegmentWriteKey', () => {
    it('returns default write key when env var is not set', () => {
      assert.equal(getSegmentWriteKey(), DEFAULT_SEGMENT_WRITE_KEY);
    });
  });

  describe('getCookieDomain', () => {
    it('returns .nhost.io for docs.nhost.io', () => {
      assert.equal(getCookieDomain('docs.nhost.io'), '.nhost.io');
    });

    it('returns .nhost.io for nhost.io', () => {
      assert.equal(getCookieDomain('nhost.io'), '.nhost.io');
    });

    it('returns .nhost.io for app.nhost.io', () => {
      assert.equal(getCookieDomain('app.nhost.io'), '.nhost.io');
    });

    it('returns undefined for localhost', () => {
      assert.equal(getCookieDomain('localhost'), undefined);
    });

    it('returns undefined for 127.0.0.1', () => {
      assert.equal(getCookieDomain('127.0.0.1'), undefined);
    });

    it('returns undefined for vercel preview domains', () => {
      assert.equal(getCookieDomain('nhost-docs-preview.vercel.app'), undefined);
    });
  });

  describe('trackPageview', () => {
    it('calls window.analytics.page with properties', () => {
      trackPageview({ path: '/getting-started' });
      assert.equal(pageviews.length, 1);
      assert.deepEqual(pageviews[0], { path: '/getting-started' });
    });

    it('handles missing window.analytics gracefully', () => {
      if (testGlobal.window) {
        delete testGlobal.window.analytics;
      }
      assert.doesNotThrow(() => trackPageview());
    });
  });

  describe('trackSearchQuery', () => {
    it('calls window.analytics.track with docs.search.query', () => {
      trackSearchQuery('authentication');
      assert.equal(trackedEvents.length, 1);
      assert.equal(trackedEvents[0].event, 'docs.search.query');
      assert.deepEqual(trackedEvents[0].properties, {
        query: 'authentication',
      });
    });

    it('ignores empty queries', () => {
      trackSearchQuery('   ');
      assert.equal(trackedEvents.length, 0);
    });
  });

  describe('trackSearchResultClick', () => {
    it('calls window.analytics.track with docs.search.result_click', () => {
      trackSearchResultClick(
        'auth',
        '/products/auth',
        'Authentication Overview',
      );
      assert.equal(trackedEvents.length, 1);
      assert.equal(trackedEvents[0].event, 'docs.search.result_click');
      assert.deepEqual(trackedEvents[0].properties, {
        query: 'auth',
        url: '/products/auth',
        title: 'Authentication Overview',
      });
    });
  });

  describe('trackCodeCopy', () => {
    it('calls window.analytics.track with docs.code_block.copy', () => {
      trackCodeCopy('typescript', 'const client = new NhostClient();');
      assert.equal(trackedEvents.length, 1);
      assert.equal(trackedEvents[0].event, 'docs.code_block.copy');
      assert.deepEqual(trackedEvents[0].properties, {
        language: 'typescript',
        code: 'const client = new NhostClient();',
      });
    });

    it('defaults language to plaintext if unspecified', () => {
      trackCodeCopy(undefined, 'npm install');
      assert.equal(trackedEvents.length, 1);
      assert.equal(trackedEvents[0].event, 'docs.code_block.copy');
      assert.deepEqual(trackedEvents[0].properties, {
        language: 'plaintext',
        code: 'npm install',
      });
    });
  });

  describe('trackPageFeedback', () => {
    it('calls window.analytics.track with docs.page.feedback for helpful response', () => {
      trackPageFeedback(true, '/products/graphql', 'GraphQL API');
      assert.equal(trackedEvents.length, 1);
      assert.equal(trackedEvents[0].event, 'docs.page.feedback');
      assert.deepEqual(trackedEvents[0].properties, {
        helpful: true,
        path: '/products/graphql',
        title: 'GraphQL API',
      });
    });

    it('calls window.analytics.track with docs.page.feedback for unhelpful response', () => {
      trackPageFeedback(false, '/products/storage', 'Storage');
      assert.equal(trackedEvents.length, 1);
      assert.equal(trackedEvents[0].event, 'docs.page.feedback');
      assert.deepEqual(trackedEvents[0].properties, {
        helpful: false,
        path: '/products/storage',
        title: 'Storage',
      });
    });
  });
});
