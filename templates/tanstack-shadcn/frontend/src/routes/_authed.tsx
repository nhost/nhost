import { createFileRoute, redirect } from '@tanstack/react-router';
import { nhost } from '@/lib/nhost/client';

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ location }) => {
    const session = nhost.getUserSession();

    if (!session) {
      throw redirect({
        to: '/signin',
        search: { redirect: location.href },
      });
    }

    // Route context has to be serializable, so expose only what the UI needs.
    return {
      user: { id: session.user?.id, email: session.user?.email },
    };
  },
});
