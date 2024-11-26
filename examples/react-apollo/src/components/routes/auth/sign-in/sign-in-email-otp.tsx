import SignInFooter from '@/components/auth/sign-in-footer'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSignInEmailOTP } from '@nhost/react'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

const emailFormSchema = z.object({
  email: z.string().email('Please enter a valid email address.')
})

export default function SignInEmailOTP() {
  const navigate = useNavigate()
  const [otp, setOTP] = useState('')
  const [email, setEmail] = useState('')
  const [showOTPSentDialog, setShowOTPSentDialog] = useState(false)

  const { signInEmailOTP, verifyEmailOTP } = useSignInEmailOTP()

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: ''
    }
  })

  const onSubmitEmail = async (values: z.infer<typeof emailFormSchema>) => {
    const { email } = values
    const { isError, error } = await signInEmailOTP(email)

    if (isError) {
      toast.error(error?.message || 'Failed to send OTP. Please try again.')
    } else {
      setShowOTPSentDialog(true)
      setEmail(email)
    }
  }

  const signInWithOTP = async () => {
    const { isError, error } = await verifyEmailOTP(email, otp)

    if (isError) {
      toast.error(error?.message || 'Invalid OTP. Please try again.')
    } else {
      toast.success('Signed in successfully!')
      navigate('/')
    }
  }

  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-3xl font-semibold">Sign in with OTP</h1>

        {email ? (
          <div className="w-full flex flex-col gap-4 items-center">
            <InputOTP maxLength={6} value={otp} onChange={(value) => setOTP(value)}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" onClick={signInWithOTP}>
              Continue with OTP
            </Button>
          </div>
        ) : (
          <Form {...emailForm}>
            <form
              onSubmit={emailForm.handleSubmit(onSubmitEmail)}
              className="flex flex-col w-full space-y-4"
            >
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Enter your email"
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <Button type="submit">Send OTP</Button>
            </form>
          </Form>
        )}

        <Link to="/sign-in" className={cn(buttonVariants({ variant: 'link' }), 'my-2')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Other sign-in options
        </Link>

        <Separator className="mt-2 mb-4" />

        <SignInFooter />
      </div>

      <Dialog open={showOTPSentDialog} onOpenChange={setShowOTPSentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OTP Sent</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Please check your inbox for the OTP.</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
