'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ConnectionStateProvider } from '@/components/connection-state';

// Mounted by the root layout, so everything in here outlives a move between
// views. Anything that should survive that navigation belongs at this level.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionStateProvider>{children}</ConnectionStateProvider>
    </QueryClientProvider>
  );
}
