import { DetailedHTMLProps, HTMLProps } from 'react'

export interface LocationIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function LocationIcon(props: LocationIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="m2 7.334 12.667-6-6 12.667-1.334-5.334L2 7.334Z"
        stroke="currentColor"
        strokeWidth=".667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
