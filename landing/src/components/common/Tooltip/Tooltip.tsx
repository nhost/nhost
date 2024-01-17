interface TooltipProps {
  message: string
}

export default function Tooltip({ message }: TooltipProps) {
  return (
    <div className="group relative flex">
      <svg
        className="text-muted -ml-0.5"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
      >
        <path
          fill="currentColor"
          d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm.724-11.97c0 .463-.328.764-.774.764-.436 0-.773-.3-.773-.764s.337-.783.774-.783c.445 0 .773.319.773.783Zm1.455 6.194H9.877v-.855h1.628v-2.956H9.877v-.828h2.674v3.784h1.628v.855Z"
        ></path>
      </svg>
      <span className="tooltip absolute bottom-full left-1/2 mb-2 -translate-x-1/2 scale-0 rounded bg-gray-800 p-2 text-xs text-white transition-all group-hover:scale-100">
        {message}
      </span>
    </div>
  )
}
