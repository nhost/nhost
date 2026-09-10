import { useRouter } from 'next/router';
import { type PropsWithChildren, useEffect } from 'react';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

/**
 * Sends the page to 404 while settings are disabled for the environment: a
 * self-hosted dashboard without a config server has nothing to edit.
 */
export default function SettingsGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const isSettingsDisabled = useSettingsDisabled();

  useEffect(() => {
    if (isSettingsDisabled) {
      router.push('/404');
    }
  }, [router, isSettingsDisabled]);

  if (isSettingsDisabled) {
    return null;
  }

  return children;
}
