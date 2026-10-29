import { Search } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export interface BlogSearchFieldProps {
  id: string
  /** Screen-reader label for the input. */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function BlogSearchField({
  id,
  label,
  value,
  onChange,
  placeholder = 'Search posts',
  className,
}: BlogSearchFieldProps) {
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
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-full border border-white border-opacity-25 bg-transparent py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-white placeholder:text-opacity-40 focus:border-opacity-60 focus:outline-none"
      />
    </div>
  )
}
