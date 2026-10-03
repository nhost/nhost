'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ConnectionStateProvider } from '@/components/connection-state';
import { useSessionKeepalive } from '@/lib/nhost/useSessionKeepalive';

// Mounted by the root layout, so everything in here outlives a move between
// views. Anything that should survive that navigation belongs at this level.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Here rather than on the protected pages because it has to outlive the
  // navigation between them: mounted per page, the timer would be thrown away
  // and restarted on every move, and a tab left sitting on one page - the case
  // it exists for - is exactly where it would never get to run.
  useSessionKeepalive();

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionStateProvider>{children}</ConnectionStateProvider>
    </QueryClientProvider>
  );
}
