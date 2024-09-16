import { cn } from '@/components/../lib/utils'
import SignUpFooter from '@/components/auth/sign-up-footer'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSignUpEmailPassword } from '@nhost/react'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  password: z.string().min(8)
})

export default function SignUpEmailPassword() {
  const navigate = useNavigate()
  const { signUpEmailPassword } = useSignUpEmailPassword()
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: ''
    }
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { firstName, lastName, email, password } = values

    const result = await signUpEmailPassword(email, password, {
      metadata: { firstName, lastName, displayName: `${firstName} ${lastName}` },
      redirectTo: window.location.origin
    })

    if (result.isError) {
      toast.error(result.error?.message)
    } else if (result.needsEmailVerification) {
      setShowEmailVerificationDialog(true)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
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
                    <Input placeholder="First Name" {...field} />
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
                    <Input placeholder="Last Name" {...field} />
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
            <Button type="submit">Sign Up</Button>
          </form>
        </Form>

        <Link to="/sign-up" className={cn(buttonVariants({ variant: 'link' }), 'my-2')}>
          <ArrowLeft className="w-4 h-4" />
          Other sign-up options
        </Link>

        <Separator className="my-2" />

        <SignUpFooter />
      </div>

      <Dialog
        open={showEmailVerificationDialog}
        onOpenChange={(open) => setShowEmailVerificationDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verification email sent</DialogTitle>
          </DialogHeader>
          <p>
            You need to verify your email first. Please check your mailbox and follow the
            confirmation link to complete the registration.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
