import * as React from 'react'

function ArrowLeft(props: JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M13.5 8h-11M7 3.5L2.5 8 7 12.5"
        stroke="#0052CD"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default ArrowLeft
