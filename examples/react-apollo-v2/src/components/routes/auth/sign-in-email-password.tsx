import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form'
import { Input } from '../../ui/input'
import { Button, buttonVariants } from '../../ui/button'
import { Separator } from '../../ui/separator'

const signInFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default function SignInEmailPassword() {
  const form = useForm<z.infer<typeof signInFormSchema>>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const onSubmit = (values: z.infer<typeof signInFormSchema>) => {
    console.log({ values })
  }

  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-4xl">Email & password</h1>
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

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="password" type="password" autoComplete="none" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Button type="submit" variant={'destructive'}>
              Sign In again
            </Button>
          </form>

          <Link to="/sign-in/forgot-password" className={buttonVariants({ variant: 'link' })}>
            Forgot password
          </Link>
        </Form>

        <Separator className="my-2" />

        <Link to="/sign-in" className={buttonVariants({ variant: 'link' })}>
          <ArrowLeft className="w-4 h-4" />
          Other sign-in options
        </Link>
      </div>
    </div>
  )
}
