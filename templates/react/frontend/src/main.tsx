import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  ScrollRestoration,
} from 'react-router';
import SessionGuard from '@/components/SessionGuard';
import AuthProvider from '@/lib/nhost/AuthProvider';
import { startSession } from '@/lib/nhost/startSession';
import { routes } from '@/router';

// Before the router reads the URL, so it never sees a link token, and before
// the first render, so no page shows a session that is about to change.
await startSession();

const router = createBrowserRouter([
  {
    // ScrollRestoration starts each new page at the top, as Next does, and
    // puts Back where it was.
    element: (
      <AuthProvider>
        <ScrollRestoration />
        <SessionGuard>
          <Outlet />
        </SessionGuard>
      </AuthProvider>
    ),
    children: routes,
  },
]);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
