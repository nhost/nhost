import { twMerge } from 'tailwind-merge'

export interface BlogTagFilterProps {
  tags: string[]
  /** The active tag, or `null` when none is. */
  selected: string | null
  /** Called with the clicked tag, or `null` when the active one is clicked. */
  onChange: (tag: string | null) => void
}

export default function BlogTagFilter({
  tags,
  selected,
  onChange,
}: BlogTagFilterProps) {
  if (tags.length === 0) {
    return null
  }

  // One row that scrolls sideways when it doesn't fit. `w-max mx-auto` centers
  // it when it fits; `justify-center` would clip the start once it overflows.
  return (
    <div className="overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul aria-label="Filter by tag" className="mx-auto flex w-max gap-2">
        {tags.map((tag) => {
          const active = tag === selected

          return (
            <li key={tag}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(active ? null : tag)}
                className={twMerge(
                  'whitespace-nowrap rounded-full border border-divider px-3 py-1 text-xs text-white text-opacity-65 hover:border-white hover:border-opacity-40 hover:text-opacity-100 motion-safe:transition-colors',
                  active &&
                    'border-white bg-white text-black text-opacity-100 hover:border-white',
                )}
              >
                {tag}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
