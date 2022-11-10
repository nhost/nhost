import type { PropsWithChildren } from 'react';

export function Badge({ children }: PropsWithChildren<unknown>) {
  return (
    <div className="relative -top-1 ml-1 transform self-center font-display text-xs font-medium capitalize text-blue">
      {children}
    </div>
  );
}

export default Badge;
