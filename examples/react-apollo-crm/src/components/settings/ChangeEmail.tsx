import { useChangeEmail } from '@nhost/react'
import { useState } from 'react'
import { SettingsBox } from '../ui/Settings'

export function ChangeEmail() {
  const [newEmail, setNewEmail] = useState('')

  const { changeEmail, isLoading, isError, error, needsEmailVerification } = useChangeEmail()

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    console.log('new email')

    try {
      await changeEmail(newEmail)
    } catch (error) {
      console.log('error')
      console.log(error)
    }

    console.log('done')
  }

  return (
    <SettingsBox>
      <form onSubmit={handleSubmit}>
        <div className="">
          <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
            New Email
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="first-name"
              id="first-name"
              autoComplete="given-name"
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="pt-3">
          <div className="">
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Change Email
            </button>
          </div>
        </div>
        {isError && (
          <div className="text p-2 my-2 border rounded-sm shadow-md bg-red-400 text-white">
            {error.message}
          </div>
        )}
        {needsEmailVerification && (
          <div className="text p-2 my-2 border rounded-sm shadow-md bg-green-400 text-white">
            An email has been sent to confirm your new email address.
          </div>
        )}
      </form>
    </SettingsBox>
  )
}
