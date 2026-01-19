import { type JSX, lazy, Suspense } from 'react';
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
import { AuthProvider } from './lib/nhost/AuthProvider';
import Home from './pages/Home';
import Profile from './pages/Profile';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Todos from './pages/Todos';
import Upload from './pages/Upload';
import Verify from './pages/Verify';

const MfaVerification = lazy(() => import('./pages/signin/mfa'));

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
      <Route index element={<Home />} />
      <Route path="signin" element={<SignIn />} />
      <Route
        path="signin/mfa"
        element={
          <Suspense
            fallback={<div className="loading-container">Loading...</div>}
          >
            <MfaVerification />
          </Suspense>
        }
      />
      <Route path="signup" element={<SignUp />} />
      <Route path="verify" element={<Verify />} />
      <Route element={<ProtectedRoute />}>
        <Route path="profile" element={<Profile />} />
        <Route path="todos" element={<Todos />} />
        <Route path="upload" element={<Upload />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Route>,
  ),
);

const App = (): JSX.Element => {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
};

export default App;
