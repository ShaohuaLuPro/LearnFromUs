import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AgentChatbox from './components/AgentChatbox';
import Footer from './components/Footer';
import Header from './components/Header';
import RouteSeo from './components/RouteSeo';
import { useAuth } from './context/AuthContext';
import { usePosts } from './context/PostsContext';
import About from './pages/About';
import Analytics from './pages/Analytics';
import Following from './pages/Following';
import Goodbye from './pages/Goodbye';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Moderation from './pages/Moderation';
import MyPosts from './pages/MyPosts';
import PostDetail from './pages/PostDetail';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';

function LoadingShell() {
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

export default function AppRoutes() {
  const auth = useAuth();
  const posts = usePosts();

  if (auth.authLoading || (!posts.initialized && posts.loadingPosts)) {
    return <LoadingShell />;
  }

  const updateProfile = async ({ name }: { name: string }) => {
    const result = await auth.updateProfile({ name });
    if (result.ok && result.user) {
      posts.syncAuthorName(result.user.id, result.user.name);
    }
    return result;
  };

  const deleteAccount = async () => {
    const authorId = auth.currentUser?.id || '';
    const result = await auth.deleteAccount();
    if (result.ok && authorId) {
      posts.removeAuthorPosts(authorId);
    }
    return result;
  };

  return (
    <div className="app-wrapper d-flex flex-column min-vh-100">
      <RouteSeo />
      <Header currentUser={auth.currentUser} onLogout={auth.logout} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Landing currentUser={auth.currentUser} />} />
          <Route
            path="/forum"
            element={(
              <Home
                posts={posts.posts}
                pagination={posts.pagination}
                currentFilters={posts.filters}
                loadingPosts={posts.loadingPosts}
                currentUser={auth.currentUser}
                onLoadPosts={posts.loadPosts}
                onCreatePost={posts.createPost}
              />
            )}
          />
          <Route
            path="/forum/section/:sectionId"
            element={(
              <Home
                posts={posts.posts}
                pagination={posts.pagination}
                currentFilters={posts.filters}
                loadingPosts={posts.loadingPosts}
                currentUser={auth.currentUser}
                onLoadPosts={posts.loadPosts}
                onCreatePost={posts.createPost}
              />
            )}
          />
          <Route path="/about" element={<About />} />
          <Route path="/goodbye" element={<Goodbye />} />
          <Route path="/users/:userId" element={<UserProfile currentUser={auth.currentUser} />} />
          <Route
            path="/following"
            element={auth.currentUser ? <Following /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/settings"
            element={auth.currentUser ? (
              <Settings
                currentUser={auth.currentUser}
                onUpdateProfile={updateProfile}
                onUpdatePassword={auth.updatePassword}
                onDeleteAccount={deleteAccount}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/my-posts"
            element={auth.currentUser ? (
              <MyPosts
                currentUser={auth.currentUser}
                onUpdatePost={posts.updatePost}
                onAiRewritePost={posts.aiRewritePost}
                onDeletePost={posts.deletePost}
                onAppealPost={posts.appealPost}
                onGetMyPosts={posts.getMyPosts}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/moderation"
            element={auth.currentUser?.isAdmin ? (
              <Moderation
                onGetModerationPosts={posts.getModerationPosts}
                onRestorePost={posts.adminRestorePost}
              />
            ) : (
              <Navigate to="/forum" replace />
            )}
          />
          <Route
            path="/analytics"
            element={auth.currentUser?.isAdmin ? (
              <Analytics
                onQueryAdminAnalytics={posts.queryAdminAnalytics}
                onGetParquetDatasets={posts.getAdminParquetDatasets}
                onDownloadParquetDataset={posts.downloadAdminParquetDataset}
              />
            ) : (
              <Navigate to="/forum" replace />
            )}
          />
          <Route
            path="/login"
            element={auth.currentUser ? (
              <Navigate to="/forum" replace />
            ) : (
              <Login
                onLogin={auth.login}
                onRegister={auth.register}
                onRequestPasswordReset={auth.requestPasswordReset}
                onConfirmPasswordReset={auth.confirmPasswordReset}
              />
            )}
          />
          <Route
            path="/forum/post/:postId"
            element={(
              <PostDetail
                currentUser={auth.currentUser}
                onAdminRemovePost={posts.adminRemovePost}
                onGetPostDetail={posts.getPostDetail}
                onGetComments={posts.getComments}
                onCreateComment={posts.createComment}
              />
            )}
          />
        </Routes>
      </main>
      <Footer />
      <AgentChatbox
        currentUser={auth.currentUser}
        onAgentChat={posts.agentChat}
        onCreatePost={posts.createPost}
      />
    </div>
  );
}
