import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import {
  TOKEN_KEY,
  apiCreatePost,
  apiDeletePost,
  apiGetPosts,
  apiLogin,
  apiMe,
  apiRegister,
  apiUpdatePost
} from './api';
import './App.css';

function App() {
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    async function bootstrap() {
      try {
        const [{ posts: remotePosts }, me] = await Promise.all([
          apiGetPosts(),
          token ? apiMe(token) : Promise.resolve(null)
        ]);
        setPosts(remotePosts || []);
        if (me?.user) setCurrentUser(me.user);
      } catch {
        setPosts([]);
      } finally {
        setAuthLoading(false);
      }
    }
    bootstrap();
  }, []);

  const register = async ({ name, email, password }) => {
    try {
      const data = await apiRegister({ name, email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      setCurrentUser(data.user);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const login = async ({ email, password }) => {
    try {
      const data = await apiLogin({ email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      setCurrentUser(data.user);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
  };

  const createPost = async ({ title, content, tag }) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, message: 'Please login first.' };
    try {
      const data = await apiCreatePost({ title, content, tag }, token);
      setPosts((prev) => [data.post, ...prev]);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const updatePost = async (postId, input) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, message: 'Please login first.' };
    try {
      const data = await apiUpdatePost(postId, input, token);
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const deletePost = async (postId) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, message: 'Please login first.' };
    try {
      await apiDeletePost(postId, token);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  if (authLoading) {
    return <div className="container page-shell"><p className="muted">Loading forum...</p></div>;
  }

  return (
    <BrowserRouter basename="/LearnFromUs">
      <div className="app-wrapper d-flex flex-column min-vh-100">
        <Header currentUser={currentUser} onLogout={logout} />
        <main className="app-main">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  posts={posts}
                  currentUser={currentUser}
                  onCreatePost={createPost}
                  onUpdatePost={updatePost}
                  onDeletePost={deletePost}
                />
              }
            />
            <Route path="/about" element={<About />} />
            <Route
              path="/login"
              element={currentUser ? <Navigate to="/" replace /> : <Login onLogin={login} onRegister={register} />}
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
