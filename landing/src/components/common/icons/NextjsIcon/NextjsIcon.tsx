import { DetailedHTMLProps, HTMLProps } from 'react'

export interface NextjsIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function NextjsIcon(props: NextjsIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#clip0_210_13847)">
        <path
          d="M12.2092 3.57403C8.04191 1.1237 2.74659 4.11647 2.7005 8.94807C2.65551 13.6661 7.64853 16.7134 11.8065 14.6369L7.26672 7.95765V12.0919C7.26672 12.55 6.39016 12.55 6.39016 12.0919V6.54962C6.39016 6.18599 7.06563 6.15614 7.25705 6.47222L12.4315 14.2807C16.3185 11.777 16.266 5.95936 12.2092 3.57403ZM11.6246 11.3983L10.7453 10.0552V6.37826C10.7453 6.03541 11.6246 6.03541 11.6246 6.37826V11.3983H11.6246Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="clip0_210_13847">
          <rect
            width="12.6"
            height="12.6"
            fill="currentColor"
            transform="translate(2.7002 2.7002)"
          />
        </clipPath>
      </defs>
    </svg>
  )
}
