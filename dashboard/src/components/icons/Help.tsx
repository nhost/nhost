import * as React from 'react';

function Help(props: any) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x={8}
        y={8}
        width={24}
        height={24}
        rx={12}
        fill="#0052CD"
        fillOpacity={0.2}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.658 14.815a3.375 3.375 0 00-4.033 3.31h1.5A1.875 1.875 0 1120 20a.75.75 0 00-.75.75V23h1.5v-1.584a3.375 3.375 0 00-.092-6.6zm.467 10.06a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0z"
        fill="#0052CD"
      />
    </svg>
  );
}

export default Help;
