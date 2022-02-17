import axios from 'axios'
import React, { useEffect } from 'react'
import { useState } from 'react'

import Input from './ui/Input/Input'
import Loading from './ui/Loading'

function NewsletterForm(props) {
  return (
    <div className="flex flex-row w-64 mt-5">
      <form
        className="grid grid-flow-row sm:grid-flow-col gap-4"
        onSubmit={(e) => props.subscribe(e)}
      >
        <Input
          color="dark"
          placeholder="Email address"
          value={props.email}
          onChange={props.setEmail}
          type="email"
        />
        <button
          className="btn-subscribe font-display text-greyscaleDark font-medium cursor-pointer"
          disabled={!props.email}
        >
          {!props.loading ? 'Subscribe' : <Loading />}
        </button>
      </form>
    </div>
  )
}

function NewsletterError({ errorMessage, retry }) {
  const formattedError = errorMessage.includes('already a list member')
    ? errorMessage.split('.').slice(0, 2).join('.')
    : errorMessage
  return (
    <div className="grid grid-flow-row md:grid-flow-col gap-4 mt-5">
      <p className="text-white font-normal text-sm mt-2.5">{formattedError}.</p>
      <button
        className="btn-subscribe font-display text-greyscaleDark font-medium cursor-pointer"
        onClick={() => {
          retry()
        }}
      >
        Try again
      </button>
    </div>
  )
}

export function Newsletter() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async function (e) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await axios.post('/api/add-email-to-newsletter', {
        email
      })
      if (!res.data.success) {
        setError(res.data.message)
        return
      }
      setSuccess(res.data.message)
    } catch (error) {
      setError(
        error.message ||
          "We've encountered an error while subscribing you. Try again in a few seconds"
      )
    } finally {
      setEmail('')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (success) {
      let id = setInterval(() => {
        setSuccess('')
      }, 5000)
      return () => clearInterval(id)
    }
  }, [success])

  return (
    <div className="font-display flex flex-col mt-16">
      <div className="md:px-0 w-full mx-auto">
        <h1 className="font-medium text-gray-700 uppercase">newsletter</h1>
        <p className="text-white font-normal text-sm+  mt-2.5">
          Platform updates and news on web and mobile development.
        </p>
        {error ? (
          <NewsletterError errorMessage={error} retry={() => setError('')} />
        ) : !success ? (
          <NewsletterForm
            email={email}
            setEmail={setEmail}
            subscribe={handleSubmit}
            loading={loading}
          />
        ) : (
          <NewsletterSuccess success={success} />
        )}
      </div>
    </div>
  )
}

function NewsletterSuccess({ success }) {
  return (
    <div className="flex flex-row mt-5">
      <p className="text-white font-normal text-sm mt-2.5">{success}</p>
    </div>
  )
}
