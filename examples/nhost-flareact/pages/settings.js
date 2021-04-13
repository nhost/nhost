import { useState } from "react";
import { PrivateRoute } from "../components/private-route";
import { Layout } from "../components/app/layout";
import { auth } from "../utils/nhost";

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await auth.changePassword(currentPassword, newPassword);
    } catch (error) {
      console.log(error);
      return alert("error saving password");
    }

    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <div>
      <h2>Change password</h2>
      <div>
        <form onSubmit={handleSubmit}>
          <div>
            <input
              placeholder="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <input
              placeholder="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <button type="submit">Change password</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Settings() {
  return (
    <Layout>
      <div>
        <h1>Settings</h1>
        <div>
          <ChangePassword />
        </div>
      </div>
    </Layout>
  );
}

export default PrivateRoute(Settings);