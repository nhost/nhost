import { useNhostAuth } from "@nhost/react-auth";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router-dom";
import { nhost } from "../utils/nhost";

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { isAuthenticated } = useNhostAuth();

  let navigate = useNavigate();

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { error } = await nhost.auth.signUp({ email, password });

    if (error) {
      return alert(error.message);
    }

    navigate("/", { replace: true });
  };

  if (isAuthenticated) {
    navigate("/");
  }

  return (
    <>
      <div className="flex flex-col justify-center min-h-full py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="text-2xl font-bold text-blue-700">AquaSystem</div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-center text-gray-900">
            Sign Up to AquaSystem
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="px-4 py-8 bg-white shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    tabIndex={1}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    tabIndex={2}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  tabIndex={3}
                >
                  Sign Up
                </button>
              </div>
            </form>
          </div>

          <div className="text-center py-4">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-blue-600 hover:text-blue-500">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
