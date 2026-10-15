import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

function useRemoveQueryParamsFromUrl() {
  const navigate = useNavigate();

  const removeQueryParam = useCallback(
    (...paramsToRemove: string[]) => {
      void navigate({
        to: '.',
        search: (prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(
              ([key]) => !paramsToRemove.includes(key),
            ),
          ),
        resetScroll: false,
      });
    },
    [navigate],
  );

  return removeQueryParam;
}

export default useRemoveQueryParamsFromUrl;
