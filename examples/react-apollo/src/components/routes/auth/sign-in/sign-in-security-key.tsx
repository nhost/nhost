import SignInFooter from "@/components/auth/sign-in-footer";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth";
import { useNhostClient } from "@/providers/nhost";
import { FetchError } from "@nhost/nhost-js/fetch";
import { ErrorResponse } from "@nhost/nhost-js/auth";

export default function SignInSecurityKey() {
  const { user } = useAuth();
  const nhost = useNhostClient();
  const navigate = useNavigate();
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignInSecurityKey = async () => {
    try {
      const response = await nhost.auth.signInWebauthn();

      if (response.body) {
        navigate("/", { replace: true });
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;

      if (error?.body) {
        const errorCode = error.body.error;
        if (errorCode === "unverified-user") {
          await nhost.auth.sendVerificationEmail({ email: user?.email || "" });
          setShowEmailVerificationDialog(true);
          return;
        }
        toast.error(error.body.message);
      } else {
        toast.error(
          error?.message ||
            "An error occurred while signing in. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }

    // if (isError) {
    //   toast.error(error?.message)
    // } else if (needsEmailVerification) {
    //   setShowEmailVerificationDialog(true)
    // } else if (isSuccess) {
    //   navigate('/', { replace: true })
    // }
  };

  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-3xl">Sign in with a security key</h1>

        <Button
          onClick={handleSignInSecurityKey}
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? "Signing In..." : "Sign In"}
          Sign In
        </Button>

        <Link
          to="/sign-in"
          className={cn(buttonVariants({ variant: "link" }), "my-2")}
        >
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
            You need to verify your email first. Please check your mailbox and
            follow the confirmation link to complete the registration.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
