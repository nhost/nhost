import { DetailedHTMLProps, HTMLProps } from 'react'

export interface FlutterIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function FlutterIcon(props: FlutterIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M14.2267 8.51587L10.8349 11.9076L14.2267 15.3002H10.3498L8.89609 13.8465L6.95724 11.9076L10.3498 8.51587H14.2267ZM10.3498 2.7002L4.0498 9.0002L5.98864 10.939L14.2267 2.7002H10.3498Z"
        fill="currentColor"
      />
    </svg>
  )
}
