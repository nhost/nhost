import { DetailedHTMLProps, HTMLProps } from 'react'

export interface BarChartIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function BarChartIcon(props: BarChartIconProps) {
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
        d="M8 13.333V6.666m4 6.667V2.666M4 13.333v-2.667"
        stroke="currentColor"
        strokeWidth=".667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
