import type { SVGProps } from 'react';

export function PartialPermissionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Partial permission"
      {...props}
    >
      <path fill="currentColor" d="M5 15h10v2.5H5z" fillOpacity={0.3} />
      <path fill="currentColor" d="M5 8.75h10v2.5H5z" />
      <path fill="currentColor" d="M5 2.5h10V5H5z" fillOpacity={0.3} />
    </svg>
  );
}
