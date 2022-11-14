import clsx from 'clsx';
import React from 'react';

export type LoadingColors = 'white' | 'dark';

export interface LoadingProps {
  color?: LoadingColors;
  className?: string;
}

export default function Loading({
  color = 'dark',
  className = 'w-5 h-5',
}: LoadingProps) {
  return (
    <svg
      className={clsx(
        'mx-auto h-5 w-5 animate-spin self-center text-center align-middle',
        color === 'dark' ? 'text-dark' : '',
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="progressbar"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
