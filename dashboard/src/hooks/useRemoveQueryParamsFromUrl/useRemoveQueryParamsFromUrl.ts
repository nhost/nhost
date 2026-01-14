import Router from 'next/router';
import { useCallback } from 'react';

function useRemoveQueryParamsFromUrl() {
  const removeQueryParam = useCallback((...paramsToRemove: string[]) => {
    const newQuery = { ...Router.query };

    paramsToRemove.forEach((param) => {
      delete newQuery[param];
    });
    Router.push(
      {
        pathname: Router.pathname,
        query: newQuery,
      },
      undefined,
      { shallow: true },
    );
  }, []);

  return removeQueryParam;
}

export default useRemoveQueryParamsFromUrl;
