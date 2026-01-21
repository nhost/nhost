import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { useNhostClient } from "@/providers/nhost";

export default function SignInFooter() {
  const navigate = useNavigate();
  const nhost = useNhostClient();

  const anonymousHandler = async () => {
    try {
      const response = await nhost.auth.signInAnonymous();

      if (response.body.session) {
        navigate("/");
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      // Handle network errors or other exceptions
      console.error("Failed to sign in anonymously:", error);
      // toast.error('Failed to sign in. Please try again.')
    }
  };

  return (
    <p className="text-sm text-center">
      Don&lsquo;t have an account?{" "}
      <Link
        to="/sign-up"
        className={cn(buttonVariants({ variant: "link" }), "m-0, p-0")}
      >
        Sign up
      </Link>{" "}
      or{" "}
      <Button variant="link" className="p-0 m-0" onClick={anonymousHandler}>
        sign in anonymously
      </Button>
    </p>
  );
}
