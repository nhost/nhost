import { DetailedHTMLProps, HTMLProps } from 'react'

export interface CheckmarkCircleIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function CheckmarkCircleIcon(props: CheckmarkCircleIconProps) {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18.334 9.233V10a8.334 8.334 0 1 1-4.942-7.617" />
        <path d="M18.333 3.333 10 11.675l-2.5-2.5" />
      </g>
    </svg>
  )
}
