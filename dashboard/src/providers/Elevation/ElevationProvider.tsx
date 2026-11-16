import type { ElevationMethod } from '@nhost/nhost-js/auth';
import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ElevateSessionDialog } from '@/components/common/ElevateSessionDialog';
import { useHasuraClaims } from '@/hooks/useHasuraClaims';
import { useUserData } from '@/hooks/useUserData';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import { ElevationContext } from './ElevationContext';

function ElevationProvider({ children }: PropsWithChildren) {
  const nhost = useNhostClient();
  const user = useUserData();
  const claims = useHasuraClaims();
  const [methods, setMethods] = useState<ElevationMethod[]>([]);
  const [open, setOpen] = useState(false);
  const pendingRequest = useRef<((elevated: boolean) => void) | null>(null);

  const isElevated = Boolean(
    user && claims?.['x-hasura-auth-elevated'] === user.id,
  );

  const settle = useCallback((elevated: boolean) => {
    setOpen(false);

    const resolve = pendingRequest.current;
    pendingRequest.current = null;
    resolve?.(elevated);
  }, []);

  const requestElevation = useCallback(async () => {
    if (isElevated) {
      return true;
    }

    try {
      const { body } = await nhost.auth.getElevationMethods();

      if (!body.elevationRequired) {
        return true;
      }

      if (body.methods.length === 0) {
        toast.error(
          'Add a security key or set up an authenticator app before performing this action.',
          getToastStyleProps(),
        );
        return false;
      }

      setMethods(body.methods);
      setOpen(true);

      return await new Promise<boolean>((resolve) => {
        // A double click can start a second request before the dialog opens;
        // only the latest one goes on, so the earlier one is cancelled.
        pendingRequest.current?.(false);
        pendingRequest.current = resolve;
      });
    } catch (error) {
      toast.error(
        error?.message || 'Could not verify your security settings.',
        getToastStyleProps(),
      );
      return false;
    }
  }, [isElevated, nhost]);

  const value = useMemo(() => ({ requestElevation }), [requestElevation]);

  return (
    <ElevationContext.Provider value={value}>
      {children}

      <ElevateSessionDialog
        open={open}
        methods={methods}
        onCancel={() => settle(false)}
        onElevated={() => settle(true)}
      />
    </ElevationContext.Provider>
  );
}

export default ElevationProvider;
