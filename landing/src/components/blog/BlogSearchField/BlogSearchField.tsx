export interface BlogSearchFieldProps {
  id: string
  /** Screen-reader label for the input. */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function BlogSearchField({
  id,
  label,
  value,
  onChange,
  placeholder = 'Search posts, topics, or authors',
}: BlogSearchFieldProps) {
  return (
    <div className="mx-auto w-full max-w-md">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-white border-opacity-25 bg-transparent px-4 py-3 text-base text-white placeholder:text-white placeholder:text-opacity-40 focus:border-opacity-60 focus:outline-none"
      />
    </div>
  )
}
