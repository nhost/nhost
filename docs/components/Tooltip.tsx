export function Tooltip({ text, children, position = '-mx-20', color = '' }) {
  return (
    <div className="relative has-tooltip">
      {children}

      <span
        className={`z-50 px-1.5 py-0.5 text-sm bg-verydark -my-12 -mx-9 text-white rounded-sm shadow-2xl border tooltip font-medium`}
      >
        {text}
      </span>
      <svg
        className="absolute z-50 w-3 h-2 text-verydark transform tooltip -top-2 right-0.5"
        x="0px"
        y="0px"
        viewBox="0 0 255 255"
        xmlSpace="preserve"
      >
        <polygon
          className="border border-white fill-current text-lightbrand"
          points="0,0 127.5,127.5 255,0"
        />
      </svg>
    </div>
  )
}
