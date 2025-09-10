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

// Root layout component to wrap all routes
const RootLayout = () => {
  return (
    <>
      <Navigation />
      <div className="app-content">
        <Outlet />
      </div>
    </>
  );
};

// Create router with routes
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route index element={<Home />} />
      <Route element={<ProtectedRoute />}>
        <Route path="profile" element={<Profile />} />
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
