import type { CustomClaim } from '@/types/application';
import { useGetAppCustomClaimsQuery } from '@/utils/__generated__/graphql';

export type UseCustomClaimsProps = {
  /**
   * Application identifier.
   */
  appId: string;
};

export default function useCustomClaims({ appId }: UseCustomClaimsProps) {
  const { data, loading, error } = useGetAppCustomClaimsQuery({
    variables: { id: appId },
  });

  const systemClaims: CustomClaim[] = [
    { key: 'User-Id', value: 'id', system: true },
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
      loading,
      error,
    };
  }

  return {
    data: systemClaims,
    loading,
    error,
  };
}
