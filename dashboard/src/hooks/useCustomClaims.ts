import type { CustomClaim } from '@/types/application';
import { useGetAppCustomClaimsQuery } from '@/utils/__generated__/graphql';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

export interface UseCustomClaimsProps {
  /**
   * Application identifier.
   */
  appId?: string;
}

export default function useCustomClaims(props?: UseCustomClaimsProps) {
  const { appId } = props || {};
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, ...rest } = useGetAppCustomClaimsQuery({
    variables: { id: currentApplication?.id || appId },
  });

  const systemClaims: CustomClaim[] = [
    { key: 'User-Id', value: 'id', isSystemClaim: true },
  ];

  if (data?.app) {
    const storedClaims: CustomClaim[] = Object.keys(
      data.app.authJwtCustomClaims,
    )
      .sort()
      .map((key) => ({
        key,
        value: data.app.authJwtCustomClaims[key],
      }));

    return {
      data: systemClaims.concat(storedClaims),
      ...rest,
    };
  }

  return {
    data: systemClaims,
    ...rest,
  };
}
