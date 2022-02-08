import * as React from 'react'

function ArrowRight(props: JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2.5 8h11M9 3.5L13.5 8 9 12.5"
        stroke="#0052CD"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default ArrowRight
