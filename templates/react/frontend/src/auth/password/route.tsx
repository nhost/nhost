import { Link } from 'react-router';
import PasswordForm from '@/auth/password/PasswordForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useNext } from '@/signin/useNext';

export default function PasswordPage() {
  const next = useNext();

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Email and password</CardTitle>
          <CardDescription>
            Sign in, or sign up and confirm your address by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasswordForm next={next} />
          <Link
            to="/signin"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Other ways to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
