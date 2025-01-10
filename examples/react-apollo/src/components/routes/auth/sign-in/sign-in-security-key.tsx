import SignInFooter from '@/components/auth/sign-in-footer'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useSignInSecurityKey } from '@nhost/react'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function SignInSecurityKey() {
  const navigate = useNavigate()
  const { signInSecurityKey } = useSignInSecurityKey()
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] = useState(false)

  const handleSignInSecurityKey = async () => {
    const { isError, isSuccess, needsEmailVerification, error } = await signInSecurityKey()

    if (isError) {
      toast.error(error?.message)
    } else if (needsEmailVerification) {
      setShowEmailVerificationDialog(true)
    } else if (isSuccess) {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-3xl">Sign in with a security key</h1>

        <Button onClick={handleSignInSecurityKey} className="w-full">
          Sign In
        </Button>

        <Link to="/sign-in" className={cn(buttonVariants({ variant: 'link' }), 'my-2')}>
          <ArrowLeft className="w-4 h-4" />
          Other sign-in options
        </Link>

        <Separator className="mt-2 mb-4" />

        <SignInFooter />
      </div>

      <Dialog
        open={showEmailVerificationDialog}
        onOpenChange={(open) => setShowEmailVerificationDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email verification required</DialogTitle>
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
