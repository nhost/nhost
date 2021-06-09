import React, { useState } from "react";
import { useRouter } from "flareact/router";
import Link from "flareact/link";

import { auth } from "../utils/nhost";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await auth.login({ email, password });
    } catch (error) {
      console.log(error);
      return alert("login failed");
    }

    router.push("/");
  }

  return (
    <div>
      <div>Login</div>
      <div>
        <form onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoFocus
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <button type="submit">Login</button>
          </div>
        </form>
      </div>
      <div>
        <Link href="/register">
          <a>Register</a>
        </Link>
      </div>
    </div>
  );
}