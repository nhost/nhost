import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './lib/nhost/AuthProvider';
import Home from './pages/Home';
import Protected from './pages/Protected';
import SignIn from './pages/SignIn';

const queryClient = new QueryClient();

function Nav() {
  const { isAuthenticated } = useAuth();

  return (
    <nav className="nav">
      <Link to="/">Nhost + React</Link>
      <div className="row">
        <Link to="/signin">Sign in</Link>
        <Link to="/protected">
          {isAuthenticated ? 'Your todos' : 'Protected'}
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Nav />
          <main className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/protected" element={<Protected />} />
            </Routes>
          </main>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
