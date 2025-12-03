import { useRouter } from 'next/router';
import { useCallback } from 'react';

function useRemoveQueryParamsFromUrl() {
  const router = useRouter();

  const removeQueryParam = useCallback(
    (...paramsToRemove) => {
      const newQuery = { ...router.query };

      paramsToRemove.forEach((param) => delete newQuery[param]);
      router.push(
        {
          pathname: router.pathname,
          query: newQuery,
        },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );
  return removeQueryParam;
}

export default useRemoveQueryParamsFromUrl;
