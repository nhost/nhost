import type { ComponentType } from 'react';

/**
 * Every screen under `src/app/`, found rather than listed.
 *
 * A sign-in method is meant to be deletable by removing its directory and its
 * line in `signin/methods.ts`, and nothing else. A navigator naming each
 * screen would break that: deleting the directory would leave this file
 * importing a module that is gone. So the screens are collected from disk,
 * which is the same thing Expo Router does with the same directory - this
 * navigation system just does it explicitly.
 *
 * `require.context` is Metro's, and it is what Expo Router is built on too.
 */
type RequireContext = {
  keys(): string[];
  <T>(id: string): T;
};

type ContextRequire = {
  context(dir: string, deep: boolean, filter: RegExp): RequireContext;
};

// SAFETY: `require.context` is Metro's, not Node's, so the ambient `require`
// type does not describe it. Metro rewrites this call at build time into a
// generated module, which is why it has to be written as a literal call it can
// recognise rather than built up. Expo Router reads the same directory the same
// way. If the bundler ever stopped providing it the app would fail to build,
// not misbehave at runtime.
const contextRequire = require as unknown as ContextRequire;

const modules = contextRequire.context('./app', true, /\.tsx$/);

export type Screen = {
  /** The path this screen is at, which is also its name in the navigator. */
  name: string;
  component: ComponentType;
};

/**
 * './settings/index.tsx' is the screen at '/settings', and './index.tsx' is
 * the one at '/'. The same rules Expo Router reads the directory with, so both
 * navigation systems agree on what a path means and `signin/methods.ts` is
 * correct for either.
 *
 * No sign-in method is named in this file, deliberately: a method is meant to
 * be deletable by removing its directory, and anything here that spelled one
 * out - a comment included - would still be referring to it afterwards.
 */
function routePath(file: string): string {
  const path = file
    .replace(/^\./, '')
    .replace(/\.tsx$/, '')
    .replace(/\/index$/, '');

  return path === '' ? '/' : path;
}

export const screens: Screen[] = modules
  .keys()
  // `_layout` is Expo Router's shell. The scaffold leaves it out for this
  // system, and this guards against one being added back by hand.
  .filter((file) => !file.split('/').some((part) => part.startsWith('_')))
  .map((file) => ({
    name: routePath(file),
    component: modules<{ default: ComponentType }>(file).default,
  }))
  // Longest first, so a nested screen is registered before the one whose path
  // is its prefix and the deep-link matcher never settles for the shorter.
  .sort((a, b) => b.name.length - a.name.length);
