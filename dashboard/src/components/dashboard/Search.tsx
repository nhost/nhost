import { SearchIcon } from '@heroicons/react/solid';
import clsx from 'clsx';

type SearchProps = {
  placeholder?: string;
  value?: string;
  onChange?: (event: any) => void;
  width?: string;
  background?: string;
  border?: string;
};

export function Search({
  placeholder,
  value,
  onChange,
  background = 'bg-white',
  width = 'w-feedback',
  border = 'border border-input',
}: SearchProps) {
  return (
    <div className="relative flex w-full flex-col self-center rounded-md">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 mr-2 flex items-center pl-2"
        aria-hidden="true"
      >
        <SearchIcon className="mr-5 h-4 w-4 text-gray-400" aria-hidden="true" />
      </div>
      <input
        className={clsx(
          'rounded-md px-4 py-2  pl-7 font-display text-sm font-normal text-greyscaleDark',
          width,
          background,
          border,
        )}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoCorrect="off"
      />
    </div>
  );
}

export default Search;
