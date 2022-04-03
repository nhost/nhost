import { useChangePassword } from '@nhost/react'
import { useState } from 'react'
import { SettingsBox } from '../ui/Settings'

export function ChangePassword() {
  const [newPassword, setNewPassword] = useState('')

  const { changePassword, isLoading, isError, error, isSuccess } = useChangePassword()

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      await changePassword(newPassword)
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
            New Password
          </label>
          <div className="mt-1">
            <input
              type="password"
              name="first-name"
              id="first-name"
              autoComplete="given-name"
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="pt-3">
          <div className="">
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-200"
              disabled={isLoading}
            >
              Set new password
            </button>
          </div>
        </div>
        {isError && (
          <div className="text p-2 my-2 border rounded-sm shadow-md bg-red-400 text-white">
            {error.message}
          </div>
        )}
        {isSuccess && (
          <div className="text p-2 my-2 border rounded-sm shadow-md bg-green-400 text-white">
            Password Updated
          </div>
        )}
      </form>
    </SettingsBox>
  )
}
