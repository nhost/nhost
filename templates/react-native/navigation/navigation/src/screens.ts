/// <reference types="expo/types" />
import type { ComponentType } from 'react';
import { linkPath } from '@/linkPath';

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

// SAFETY: Metro bundles the screens only because it finds this call written
// literally as `require.context(...)` and rewrites it into a generated module.
// Aliasing `require` or building the arguments up still builds and type-checks,
// but bundles no screens and throws on launch; the `navigation` CI job checks
// the bundle for that. The reference at the top types the call: the
// `expo-env.d.ts` that would otherwise do it is gitignored, so a fresh checkout
// has none.
const modules = require.context('./app', true, /\.tsx$/);

export type Screen = {
  /**
   * Its name in the navigator, which is the route Expo Router gives the same
   * file: '/settings', or '/notes/[id]' for a screen with a parameter.
   */
  name: string;
  /** The deep-link pattern a path is matched against to reach it. */
  path: string;
  component: ComponentType;
};

/**
 * './settings/index.tsx' is the screen at '/settings', and './index.tsx' is
 * the one at '/'. The same rules Expo Router reads the directory with for a
 * static route, so `signin/methods.ts` is correct for either system.
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
  .map((file) => {
    const name = routePath(file);

    return {
      name,
      path: linkPath(name),
      component: modules<{ default: ComponentType }>(file).default,
    };
  })
  // Longest first, so a nested screen is registered before the one whose path
  // is its prefix and the deep-link matcher never settles for the shorter.
  .sort((a, b) => b.name.length - a.name.length);
