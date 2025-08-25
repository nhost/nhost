'use client'

import { DetailedHTMLProps, HTMLProps } from 'react'
// @ts-ignore
import { useFormStatus } from 'react-dom'

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

  const { children, ...restOfInputProps } = rest

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block mb-1 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        name={name}
        required={required}
        disabled={pending}
        className="block w-full p-3 border rounded-md border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        {...restOfInputProps}
      />
    </div>
  )
}
