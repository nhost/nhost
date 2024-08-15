import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'

import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSignUpEmailPassword } from '@nhost/react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import { toast } from 'sonner'

const signUpFormSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  })

export default function SignUpEmailPassword() {
  const navigate = useNavigate()
  const { signUpEmailPassword, isLoading } = useSignUpEmailPassword()
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] = useState(false)

  const form = useForm<z.infer<typeof signUpFormSchema>>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  })

  const onSubmit = async (values: z.infer<typeof signUpFormSchema>) => {
    const { firstName, lastName, email, password } = values

    const { needsEmailVerification, isError, error, isSuccess } = await signUpEmailPassword(
      email,
      password,
      {
        displayName: `${firstName} ${lastName},`
      }
    )

    if (needsEmailVerification) {
      setShowEmailVerificationDialog(true)
      form.reset()
    }

    if (isError) {
      toast.error(error?.message)
    }

    if (isSuccess) {
      navigate('/home')
    }
  }

  return (
    <>
      <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
        <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
          <h1 className="mb-8 text-4xl">Email & password</h1>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col w-full space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="First name" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Last name" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Email" type="email" {...field} />
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
                      <Input
                        placeholder="Password"
                        type="password"
                        autoComplete="none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Confirm Password"
                        type="password"
                        autoComplete="none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                Continue with email + password
              </Button>
            </form>
          </Form>

          <Separator className="my-2" />

          <Link to="/sign-up" className={buttonVariants({ variant: 'link' })}>
            <ArrowLeft className="w-4 h-4" />
            Other sign-up options
          </Link>
        </div>
      </div>
      <Dialog
        open={showEmailVerificationDialog}
        onOpenChange={(open: boolean) => setShowEmailVerificationDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verification email sent</DialogTitle>
            <DialogDescription>
              An email has been sent to {form.getValues().email}. Please follow the lint to verify
              your email address and to complete registration.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
