import { useRouter } from 'next/router';
import { useMemo } from 'react';

type TreeState = {
  expandedItems: string[];
  focusedItem?: string;
};

const useNavTreeStateFromURL = (): TreeState => {
  const router = useRouter();

  const pathSegments = useMemo(() => router.asPath.split('/'), [router.asPath]);

  const appSubdomain = pathSegments[4] || null;
  const projectPage = pathSegments[5] || null;
  const subPage = pathSegments[6] || null;

  return useMemo(() => {
    if (!appSubdomain) {
      return { expandedItems: [], focusedItem: undefined };
    }

    if (!projectPage) {
      return { expandedItems: [], focusedItem: 'overview' };
    }

    if (projectPage === 'settings') {
      return {
        expandedItems: ['settings'],
        focusedItem: subPage ? `settings-${subPage}` : 'settings-general',
      };
    }

    if (projectPage === 'graphql') {
      return {
        expandedItems: ['graphql'],
        focusedItem: subPage ? `graphql-${subPage}` : 'graphql-playground',
      };
    }

    if (projectPage === 'events') {
      return {
        expandedItems: ['events'],
        focusedItem: subPage ? `events-${subPage}` : 'events-event-triggers',
      };
    }

    if (projectPage === 'auth') {
      return {
        expandedItems: ['auth'],
        focusedItem: subPage ? `auth-${subPage}` : 'auth-users',
      };
    }

    return { expandedItems: [], focusedItem: projectPage };
  }, [appSubdomain, projectPage, subPage]);
};

export default useNavTreeStateFromURL;
