'use client'

import Input from '@components/input'
import { createPAT } from '@server-actions/pat'
import SubmitButton from './submit-button'

export default function PATForm() {
  return (
    <form className="space-y-4" action={createPAT}>
      <Input name="name" label="Name" required />

      <Input name="expiration" type="date" required />

      <SubmitButton>Create PAT</SubmitButton>
    </form>
  )
}
