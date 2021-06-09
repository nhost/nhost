import EmailPasswordForm, { FormData } from '@modules/forms/emailPassword/EmailPasswordForm'
import { useRouter } from 'next/router'
import { ReactElement, useState } from 'react'
import { auth } from '@libs/nhost'

const RegisterForm = (): ReactElement => {
  const [registerStatus, setRegisterStatus] = useState<string | null>(null)
  const router = useRouter()

  const onSubmit = async ({ email, password }: FormData): Promise<void> => {
    try {
      await auth.register({email, password})
      router.push('/')
    } catch (e) {
      // TODO use i18n to handle multilingual
      setRegisterStatus('Unable to register')
    }
  }

  const resetRegisterForm = (): void => {
    setRegisterStatus(null)
  }

  return (
    <EmailPasswordForm
      onSubmit={onSubmit}
      formStatus={registerStatus}
      action={resetRegisterForm}
      buttonLabel="Register"
    />
  )
}

export default RegisterForm
