import { DetailedHTMLProps, HTMLProps, useState } from 'react'

export default function Input({
  id,
  type,
  name,
  label,
  required,
  className,
  ...rest
}: DetailedHTMLProps<HTMLProps<HTMLInputElement>, HTMLInputElement>) {
  const [value, setValue] = useState('')

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">
        <input
          id={id}
          type={type}
          name={name}
          required={required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="block w-full p-3 border rounded-md border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          {...rest}
        />
      </div>
    </div>
  )
}
