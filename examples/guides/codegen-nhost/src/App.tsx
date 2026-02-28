import type { JSX } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
} from 'react-router-dom';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Profile from './pages/Profile';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';

// Root layout component to wrap all routes
const RootLayout = (): JSX.Element => {
  return (
    <div className="flex-col min-h-screen">
      <Navigation />
      <main className="max-w-2xl mx-auto p-6 w-full">
        <Outlet />
      </main>
      <footer>
        <p
          className="text-sm text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          © {new Date().getFullYear()} Nhost Demo
        </p>
      </footer>
    </div>
  );
};

// Create router with routes
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route path="signin" element={<SignIn />} />
      <Route path="signup" element={<SignUp />} />
      <Route element={<ProtectedRoute />}>
        <Route path="home" element={<Home />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Route>,
  ),
);

const App = (): JSX.Element => {
  return <RouterProvider router={router} />;
};

export default App;
