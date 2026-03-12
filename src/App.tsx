import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PostsProvider } from './context/PostsContext';
import AppRoutes from './AppRoutes';
import './App.css';
import './styles/components.css';

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <PostsProvider>
          <AppRoutes />
        </PostsProvider>
      </AuthProvider>
    </HashRouter>
  );
}
