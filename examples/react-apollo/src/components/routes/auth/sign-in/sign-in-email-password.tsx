import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import SignInFooter from "@/components/auth/sign-in-footer";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useNhostClient } from "@/providers/nhost";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { ErrorResponse } from "@nhost/nhost-js/auth";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function SignInEmailPassword() {
  const nhost = useNhostClient();
  const navigate = useNavigate();
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { email, password } = values;
    setIsLoading(true);

    try {
      const response = await nhost.auth.signInEmailPassword({
        email,
        password,
      });

      // Check if MFA is required
      if (response.body?.mfa) {
        navigate(`/sign-in/mfa?ticket=${response.body.mfa.ticket}`);
        return;
      }

      // If we have a session, sign in was successful
      if (response.body?.session) {
        navigate("/", { replace: true });
      } else {
        toast.error("Failed to sign in");
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;

      if (error?.body) {
        const errorCode = error.body.error;
        if (errorCode === "unverified-user") {
          await nhost.auth.sendVerificationEmail({ email });
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
  };

  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-3xl text-center">
          Sign In with email and password
        </h1>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col w-full space-y-4"
          >
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
                    <Input
                      placeholder="password"
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
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <Link
            to="/sign-in/forgot-password"
            className={buttonVariants({ variant: "link" })}
          >
            Forgot password
          </Link>
        </Form>

        <Separator className="my-2" />

        <SignInFooter />
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
            You need to verify your email first. Please check your mailbox and
            follow the confirmation link to complete the registration.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
