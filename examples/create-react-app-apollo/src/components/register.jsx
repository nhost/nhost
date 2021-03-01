import React, { useState } from "react";
import { useHistory, Link } from "react-router-dom";

import { auth } from "utils/nhost";

export function Register() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const history = useHistory();

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
    history.push("/");
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
        <Link to="/login">Login</Link>
      </div>
    </div>
  );
}
