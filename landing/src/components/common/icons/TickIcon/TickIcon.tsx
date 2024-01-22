import { DetailedHTMLProps, HTMLProps } from 'react'

export interface TickIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function TickIcon(props: TickIconProps) {
  return (
    // <svg
    //   width="16"
    //   height="16"
    //   viewBox="0 0 16 16"
    //   fill="none"
    //   xmlns="http://www.w3.org/2000/svg"
    //   {...props}
    // >
    //   <path
    //     d="M10.75 6.5L7.08331 10L5.25 8.25"
    //     stroke="currentColor"
    //     strokeWidth="2"
    //     strokeLinecap="round"
    //     strokeLinejoin="round"
    //   />
    // </svg>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )
}
