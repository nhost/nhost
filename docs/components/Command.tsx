import React from 'react'
import { useState } from 'react'

import Check from './icons/Check'
import Copy from './icons/Copy'

export default function Command({ children }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-1 flex-row inline-flex self-center text-xs bg-gray-50 pl-2 pr-1.5 text-gray-900 font-mono leading-6 py-0.25 border border-gray-200 rounded-md">
      <span className="text-verydark mr-1.5 self-center">$</span>
      {children}
      <button
        className="ml-1.5 self-center inline-block cursor-pointer"
        onClick={() => {
          navigator.clipboard.writeText(children).catch((e) => {
            // eslint-disable-next-line no-console
            console.log(e)
          })
          setCopied(true)
          setTimeout(() => {
            setCopied(false)
          }, 1000)
        }}
      >
        {/* <Tooltip text={"Copied!"}> */}
        {copied ? (
          <Check className="w-3.5 h-3.5 mr-0.5 text-greenDark transition-colors self-center" />
        ) : (
          <Copy className="w-4 h-4 text-gray-500 transition-colors hover:text-gray-900" />
        )}
        {/* </Tooltip> */}
      </button>
    </div>
  )
}
