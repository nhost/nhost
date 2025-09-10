import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
} from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Navigation from "./components/Navigation";
import { AuthProvider } from "./lib/nhost/AuthProvider";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Verify from "./pages/Verify";
import Todos from "./pages/Todos";

const RootLayout = () => {
  return (
    <>
      <Navigation />
      <div style={{ padding: '0 2rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
        <Outlet />
      </div>
    </>
  );
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route index element={<Home />} />
      <Route path="signin" element={<SignIn />} />
      <Route path="signup" element={<SignUp />} />
      <Route path="verify" element={<Verify />} />
      <Route element={<ProtectedRoute />}>
        <Route path="profile" element={<Profile />} />
        <Route path="todos" element={<Todos />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Route>,
  ),
);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
