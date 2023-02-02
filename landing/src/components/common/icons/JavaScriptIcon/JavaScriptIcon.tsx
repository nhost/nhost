import { DetailedHTMLProps, HTMLProps } from 'react'

export interface JavaScriptIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function JavaScriptIcon(props: JavaScriptIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clip-path="url(#clip0_210_13827)">
        <path
          d="M15.3002 2.9248H2.7002V15.5248H15.3002V2.9248Z"
          fill="currentColor"
        />
        <path
          d="M11.164 12.7686C11.4178 13.183 11.748 13.4876 12.332 13.4876C12.8226 13.4876 13.136 13.2424 13.136 12.9036C13.136 12.4976 12.814 12.3538 12.274 12.1176L11.978 11.9906C11.1236 11.6266 10.556 11.1706 10.556 10.2066C10.556 9.31858 11.2326 8.64258 12.29 8.64258C13.0428 8.64258 13.584 8.90458 13.974 9.59058L13.052 10.1826C12.849 9.81858 12.63 9.67518 12.29 9.67518C11.9432 9.67518 11.7234 9.89518 11.7234 10.1826C11.7234 10.5378 11.9434 10.6816 12.4514 10.9016L12.7474 11.0284C13.7534 11.4598 14.3214 11.8996 14.3214 12.8884C14.3214 13.9544 13.484 14.5384 12.3594 14.5384C11.2598 14.5384 10.5494 14.0144 10.2018 13.3276L11.164 12.7686ZM6.98138 12.8712C7.16738 13.2012 7.33658 13.4802 7.74338 13.4802C8.13238 13.4802 8.37778 13.328 8.37778 12.7362V8.71018H9.56178V12.7522C9.56178 13.9782 8.84298 14.5362 7.79378 14.5362C6.84578 14.5362 6.29678 14.0456 6.01758 13.4547L6.98138 12.8712Z"
          fill="black"
        />
      </g>
      <defs>
        <clipPath id="clip0_210_13827">
          <rect
            width="12.6"
            height="12.6"
            fill="currentColor"
            transform="translate(2.7002 2.9248)"
          />
        </clipPath>
      </defs>
    </svg>
  )
}
