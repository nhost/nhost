import * as React from 'react';

function Plus(props: any) {
  return (
    <svg
      viewBox="0 0 32 32"
      stroke="currentColor"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 4.75C9.787 4.75 4.75 9.787 4.75 16S9.787 27.25 16 27.25 27.25 22.213 27.25 16 22.213 4.75 16 4.75zM3.25 16C3.25 8.958 8.958 3.25 16 3.25S28.75 8.958 28.75 16 23.042 28.75 16 28.75 3.25 23.042 3.25 16zm12 .75H10v-1.5h5.25V10h1.5v5.25H22v1.5h-5.25V22h-1.5v-5.25z"
      />
    </svg>
  );
}

export default Plus;
