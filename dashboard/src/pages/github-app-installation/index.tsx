import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { nhost } from '@/utils/nhost';
import { useAuthenticationStatus } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';

export function authProtected<P>(Comp: ComponentType<P>) {
  return function AuthProtected(props: P) {
    const router = useRouter();
    const { isAuthenticated, isLoading } = useAuthenticationStatus();

    useEffect(() => {
      if (isLoading || isAuthenticated) {
        return;
      }

      router.push('/signin');
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
      return <LoadingScreen />;
    }

    return <Comp {...props} />;
  };
}

function Page() {
  const [state, setState] = useState({
    error: null,
    loading: true,
  });

  const router = useRouter();
  const { installation_id: installationId } = router.query;

  useEffect(() => {
    async function installGithubApp() {
      try {
        await nhost.functions.call('/client/github-app-installation', {
          installationId,
        });
      } catch (error) {
        setState({
          error,
          loading: false,
        });

        return;
      }

      setState({
        error: null,
        loading: false,
      });

      window.close();
    }

    // run in async manner
    installGithubApp();
  }, [installationId]);

  if (state.loading) {
    return <ActivityIndicator delay={500} label="Loading..." />;
  }

  if (state.error) {
    throw state.error;
  }

  return <div>GitHub connection completed. You can close this tab.</div>;
}

export default authProtected(Page);
