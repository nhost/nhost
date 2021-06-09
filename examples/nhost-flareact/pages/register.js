import React, { useState } from "react";
import { useRouter } from "flareact/router";
import Link from "flareact/link";

import { auth } from "../utils/nhost";

export default function Register() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await auth.register({
        email,
        password,
        options: {
          userData: {
            display_name: displayName,
          },
        },
      });
    } catch (error) {
      console.log(error);
      return alert("Registration failed");
    }

    alert("Registration OK. Logging you in...");
    router.push("/");
  }

  return (
    <div>
      <div>Register</div>
      <div>
        <form onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Name"
              autoFocus
            />
          </div>
          <div>
            <input
              type="text"
              value={email}
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
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
            <button type="submit">Register</button>
          </div>
        </form>
      </div>
      <div>
        <Link href="/login">
          <a>Login</a>
        </Link>
      </div>
    </div>
  );
}