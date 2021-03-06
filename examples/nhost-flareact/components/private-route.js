import { useRouter } from "flareact/router";
import { useAuth } from "@nhost/react-auth";

export function PrivateRoute(Component) {
  return (props) => {
    const router = useRouter();
    const { signedIn } = useAuth();

    // wait to see if the user is logged in or not.
    if (signedIn === null) {
      return <div>Checking auth...</div>;
    }

    if (!signedIn) {
      router.push("/login");
      return <div>Redirecting...</div>;
    }

    console.log("render components");
    return <Component {...props} />;
  };
}
