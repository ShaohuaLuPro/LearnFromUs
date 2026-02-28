import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Settings from './pages/Settings';
import MyPosts from './pages/MyPosts';
import Goodbye from './pages/Goodbye';
import UserProfile from './pages/UserProfile';
import PostDetail from './pages/PostDetail';
import Following from './pages/Following';
import {
  TOKEN_KEY,
  apiDeleteAccount,
  apiCreatePost,
  apiDeletePost,
  apiGetPosts,
  apiLogin,
  apiMe,
  apiRegister,
  apiUpdatePassword,
  apiUpdateProfile,
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

  const updateProfile = async ({ name }) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, message: 'Please login first.' };
    try {
      const data = await apiUpdateProfile({ name }, token);
      localStorage.setItem(TOKEN_KEY, data.token);
      setCurrentUser(data.user);
      setPosts((prev) =>
        prev.map((post) =>
          post.authorId === data.user.id ? { ...post, authorName: data.user.name } : post
        )
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const updatePassword = async (input) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, message: 'Please login first.' };
    try {
      await apiUpdatePassword(input, token);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const deleteAccount = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, message: 'Please login first.' };
    try {
      await apiDeleteAccount(token);
      setPosts((prev) => prev.filter((post) => post.authorId !== currentUser?.id));
      localStorage.removeItem(TOKEN_KEY);
      setCurrentUser(null);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const createPost = async ({ title, content, section, tags }) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, message: 'Please login first.' };
    try {
      const data = await apiCreatePost({ title, content, section, tags }, token);
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
    return (
      <div className="app-loading-shell">
        <div className="container">
          <section className="app-loading-card">
            <div className="app-loading-badge">Starting up</div>
            <h1 className="app-loading-title">Waking up the forum backend.</h1>
            <p className="app-loading-copy">
              The API is running on a free instance, so the first request can take a moment while the
              server resumes.
            </p>

            <div className="app-loading-glow" />

            <div className="app-loading-skeletons">
              <div className="app-loading-skeleton app-loading-skeleton-wide" />
              <div className="app-loading-skeleton app-loading-skeleton-mid" />
              <div className="app-loading-skeleton app-loading-skeleton-card" />
              <div className="app-loading-skeleton app-loading-skeleton-card" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <HashRouter basename="/LearnFromUs">
      <div className="app-wrapper d-flex flex-column min-vh-100">
        <Header currentUser={currentUser} onLogout={logout} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Landing currentUser={currentUser} />} />
            <Route
              path="/forum"
              element={
                <Home
                  posts={posts}
                  currentUser={currentUser}
                  onCreatePost={createPost}
                />
              }
            />
            <Route
              path="/forum/section/:sectionId"
              element={
                <Home
                  posts={posts}
                  currentUser={currentUser}
                  onCreatePost={createPost}
                />
              }
            />
            <Route path="/forum/post/:postId" element={<PostDetail posts={posts} />} />
            <Route path="/about" element={<About />} />
            <Route path="/goodbye" element={<Goodbye />} />
            <Route path="/users/:userId" element={<UserProfile currentUser={currentUser} />} />
            <Route
              path="/following"
              element={currentUser ? <Following /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/settings"
              element={
                currentUser ? (
                  <Settings
                    currentUser={currentUser}
                    onUpdateProfile={updateProfile}
                    onUpdatePassword={updatePassword}
                    onDeleteAccount={deleteAccount}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/my-posts"
              element={
                currentUser ? (
                  <MyPosts
                    currentUser={currentUser}
                    posts={posts}
                    onUpdatePost={updatePost}
                    onDeletePost={deletePost}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/login"
              element={currentUser ? <Navigate to="/forum" replace /> : <Login onLogin={login} onRegister={register} />}
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </HashRouter>
  );
}

export default App;
