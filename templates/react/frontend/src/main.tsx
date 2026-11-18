import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router';
import SessionGuard from '@/components/SessionGuard';
import AuthProvider from '@/lib/nhost/AuthProvider';
import { startSession } from '@/lib/nhost/startSession';
import { routes } from '@/router';

// Before the router reads the URL, so it never sees a link token, and before
// the first render, so no page shows a session that is about to change.
await startSession();

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
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
