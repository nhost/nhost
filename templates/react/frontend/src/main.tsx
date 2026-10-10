import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from '@/App';
import '@/index.css';
import { AuthProvider } from '@/lib/nhost/AuthProvider';

const container = document.getElementById('root');

if (!container) {
  throw new Error('index.html is missing <div id="root">');
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
