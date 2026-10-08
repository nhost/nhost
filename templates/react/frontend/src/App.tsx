import type { ComponentType } from 'react';
import { Route, Routes } from 'react-router';
import LinkErrorNotice from '@/components/LinkErrorNotice';
import Nav from '@/components/Nav';
import Home from '@/Home';
import ProtectedPage from '@/protected/ProtectedPage';
import SignInPage from '@/signin/SignInPage';

/**
 * Every page under `src/auth/`, found rather than listed.
 *
 * A sign-in method is meant to be deletable by removing its directory and its
 * line in `signin/methods.ts`, and nothing else. A route table naming each
 * method would break that: deleting the directory would leave this file
 * importing a module that is gone. So the pages are collected from disk, the
 * way a file-based router does it, and this file never names a method.
 *
 * `eager` because these are the app's own routes: there is nothing to defer,
 * and it keeps the routes synchronous so there is no loading state here.
 */
const pages = import.meta.glob<{ default: ComponentType }>(
  './auth/**/route.tsx',
  { eager: true },
);

// './auth/<method>/route.tsx' is the page at '/auth/<method>', and a nested
// './auth/<method>/<step>/route.tsx' is the page one level under it. No real
// method is named here, deliberately: this file has to survive any of them
// being deleted.
const routePath = (file: string): string =>
  file.replace(/^\./, '').replace(/\/route\.tsx$/, '');

export default function App() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <LinkErrorNotice />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/protected" element={<ProtectedPage />} />
          {Object.entries(pages).map(([file, page]) => (
            <Route
              key={file}
              path={routePath(file)}
              element={<page.default />}
            />
          ))}
        </Routes>
      </main>
    </>
  );
}
