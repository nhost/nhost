import * as React from 'react'

function CaretRight(props: JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

export default CaretRight
