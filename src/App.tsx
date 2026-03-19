import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PostsProvider } from './context/PostsContext';
import AppRoutes from './AppRoutes';
import './App.css';
import './styles/components.css';

function getRouterBasename() {
  const publicUrl = String(process.env.PUBLIC_URL || '').trim();
  if (!publicUrl) {
    return '';
  }

  try {
    const parsed = new URL(publicUrl, window.location.origin);
    const pathname = parsed.pathname.replace(/\/$/, '');
    return pathname === '/' ? '' : pathname;
  } catch {
    return '';
  }
}

export default function App() {
  const basename = getRouterBasename();

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <PostsProvider>
          <AppRoutes />
        </PostsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
