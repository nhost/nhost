import { useNavigate } from '@tanstack/react-router';
import { type PropsWithChildren, useEffect } from 'react';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

/**
 * Sends the page to 404 while settings are disabled for the environment: a
 * self-hosted dashboard without a config server has nothing to edit.
 */
export default function SettingsGuard({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const isSettingsDisabled = useSettingsDisabled();

  useEffect(() => {
    if (isSettingsDisabled) {
      navigate({ to: '/404' });
    }
  }, [navigate, isSettingsDisabled]);

  if (isSettingsDisabled) {
    return null;
  }

  return children;
}
