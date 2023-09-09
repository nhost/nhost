'use client'

import { DetailedHTMLProps, HTMLProps } from 'react'
// @ts-ignore
import { experimental_useFormStatus as useFormStatus } from 'react-dom'

export default function Input({
  id,
  type,
  name,
  label,
  required,
  className,
  ...rest
}: DetailedHTMLProps<HTMLProps<HTMLInputElement>, HTMLInputElement>) {
  const { pending } = useFormStatus()

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
          disabled={pending}
          className="block w-full p-3 border rounded-md border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          {...rest}
        />
      </div>
    </div>
  )
}
