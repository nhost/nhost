import { test } from 'vitest';
import getProjectSwitchHref from './getProjectSwitchHref';

const target = { orgSlug: 'org-a', subdomain: 'project-b' };

test('keeps the feature page', () => {
  expect(
    getProjectSwitchHref({
      ...target,
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/logs',
    }),
  ).toBe('/orgs/org-a/projects/project-b/logs');
});

test('keeps the tab on the same page', () => {
  expect(
    getProjectSwitchHref({
      ...target,
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/settings',
      tab: 'secrets',
    }),
  ).toBe('/orgs/org-a/projects/project-b/settings?tab=secrets');
});

test('drops the tab when a dynamic segment was stripped', () => {
  expect(
    getProjectSwitchHref({
      ...target,
      pathname:
        '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[functionSlug]',
      tab: 'logs',
    }),
  ).toBe('/orgs/org-a/projects/project-b/functions');
});

test('applies feature path overrides', () => {
  expect(
    getProjectSwitchHref({
      ...target,
      pathname:
        '/orgs/[orgSlug]/projects/[appSubdomain]/database/schema/[dataSourceSlug]',
    }),
  ).toBe('/orgs/org-a/projects/project-b/database/schema/default');
});
