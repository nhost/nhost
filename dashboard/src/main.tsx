import '@/styles/fonts.css';
import '@/styles/globals.css';
import '@/styles/graphiql.min.css';
import '@/styles/style.css';
import '@fontsource/inter';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { RetryableErrorBoundaryFallback } from '@/components/presentational/RetryableErrorBoundary';
import { parseSearch, stringifySearch } from '@/lib/search-params';
import { routeTree } from '@/routeTree.gen';

const router = createRouter({
  routeTree,
  parseSearch,
  stringifySearch,
  defaultErrorComponent: ({ error, reset }) => (
    <RetryableErrorBoundaryFallback error={error} resetErrorBoundary={reset} />
  ),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('The #root element is missing from index.html.');
}

// No StrictMode: the Next.js app ran with `reactStrictMode: false`.
createRoot(container).render(<RouterProvider router={router} />);
