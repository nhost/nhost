import { Search, X } from 'lucide-react'
import { useRef } from 'react'
import { twMerge } from 'tailwind-merge'

export interface BlogSearchFieldProps {
  id: string
  /** Screen-reader label for the input. */
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export default function BlogSearchField({
  id,
  label,
  value,
  onChange,
  className,
}: BlogSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={twMerge('relative w-full', className)}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>

      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white text-opacity-40"
        aria-hidden
      />

      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search posts"
        autoComplete="off"
        className="w-full rounded-full border border-white border-opacity-25 bg-transparent py-1.5 pl-9 pr-10 text-sm text-white placeholder:text-white placeholder:text-opacity-40 focus:border-opacity-60 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />

      {/* Replaces the native cancel button, which is a tiny target. */}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white bg-opacity-15 text-white text-opacity-80 hover:bg-opacity-25 hover:text-opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-opacity-60 motion-safe:transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
