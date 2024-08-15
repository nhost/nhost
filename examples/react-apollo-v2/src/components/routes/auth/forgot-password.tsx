import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useSignInAnonymous } from '@nhost/react'
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form'
import { Input } from '../../ui/input'
import { Button, buttonVariants } from '../../ui/button'
import { Separator } from '../../ui/separator'
import { cn } from '../../../lib/utils'

const signInFormSchema = z.object({
  email: z.string().email()
})

export default function ForgotPassword() {
  const navigate = useNavigate()

  const { signInAnonymous } = useSignInAnonymous()

  const anonymousHandler = async () => {
    const { isSuccess } = await signInAnonymous()
    if (isSuccess) {
      navigate('/')
    }
  }

  const form = useForm<z.infer<typeof signInFormSchema>>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: ''
    }
  })

  const onSubmit = (values: z.infer<typeof signInFormSchema>) => {
    console.log({ values })
  }

  return (
    <div className="flex flex-col items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-4xl">Forgot Password</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col w-full space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="email" type="email" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Button type="submit">Reset your password</Button>
          </form>

          <Separator className="my-2" />

          <Link to="/sign-in/email-password" className={buttonVariants({ variant: 'link' })}>
            <ArrowLeft className="w-4 h-4" />
            Sign in with email + password
          </Link>
        </Form>
      </div>

      <p className="text-center">
        Don&lsquo;t have an account?
        <Link to="/sign-up" className={cn(buttonVariants({ variant: 'link' }), 'px-2')}>
          Sign up
        </Link>
        or
        <a className="px-2 hover:underline hover:cursor-pointer" onClick={anonymousHandler}>
          sign in anonymously
        </a>
      </p>
    </div>
  )
}
