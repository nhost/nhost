import type { LoadingProps } from '@/ui/Loading';
import Loading from '@/ui/Loading';
import { useEffect, useState } from 'react';

export type DelayedLoadingProps = LoadingProps & {
  /**
   * The delay in milliseconds before the loading component is shown.
   */
  delay?: number;
};

export default function DelayedLoading({
  delay,
  color = 'dark',
  ...props
}: DelayedLoadingProps) {
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShowLoadingIndicator(true), delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return showLoadingIndicator ? <Loading color={color} {...props} /> : <span />;
}
