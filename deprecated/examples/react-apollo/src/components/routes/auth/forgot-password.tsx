import { Button, buttonVariants } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useResetPassword, useSignInAnonymous } from '@nhost/react'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'

const formSchema = z.object({
  email: z.string().email()
})

export default function ForgotPassword() {
  const { resetPassword } = useResetPassword({
    redirectTo: '/profile'
  })

  const navigate = useNavigate()

  const { signInAnonymous } = useSignInAnonymous()

  const anonymousHandler = async () => {
    const { isSuccess } = await signInAnonymous()
    if (isSuccess) {
      navigate('/')
    }
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: ''
    }
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { email } = values
    const result = await resetPassword(email)

    if (result.isError) {
      toast.error(result.error?.message)
    } else {
      toast.success('A link to reset your password has been sent by email')
    }
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
