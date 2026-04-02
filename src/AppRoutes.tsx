import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AgentChatbox from './components/AgentChatbox';
import Footer from './components/Footer';
import Header from './components/Header';
import RouteSeo from './components/RouteSeo';
import { useAuth } from './context/AuthContext';
import { usePosts } from './context/PostsContext';
import About from './pages/About';
import OriginPurpose from './pages/OriginPurpose';
import AdminAccess from './pages/AdminAccess';
import AdminAccessDetail from './pages/AdminAccessDetail';
import AdminPasswordReset from './pages/AdminPasswordReset';
import Analytics from './pages/Analytics';
import Explore from './pages/Explore';
import Following from './pages/Following';
import ForumFollowersPage from './pages/ForumFollowersPage';
import ForumRequestAppealPage from './pages/ForumRequestAppealPage';
import ForumRequestHistoryPage from './pages/ForumRequestHistoryPage';
import ForumRequestPage from './pages/ForumRequestPage';
import ForumRequestReviewPage from './pages/ForumRequestReviewPage';
import Goodbye from './pages/Goodbye';
import Home from './pages/Home';
import Legal from './pages/Legal';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Moderation from './pages/Moderation';
import MyForums from './pages/MyForums';
import MyForumInvitations from './pages/MyForumInvitations';
import MyForumManagers from './pages/MyForumManagers';
import MyPosts from './pages/MyPosts';
import PostAppealRecordPage from './pages/PostAppealRecordPage';
import PostDetail from './pages/PostDetail';
import Privacy from './pages/Privacy';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
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
  const canManageAdminAccess = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.canManageAdminAccess);
  const canModerate = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('moderation'));
  const canViewAnalytics = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('analytics'));
  const canReviewForumRequests = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('forum_requests'));
  const canResetPasswords = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('password_reset'));

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
      <Header currentUser={auth.currentUser} forums={posts.forums} posts={posts.posts} onLogout={auth.logout} />
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={(
              <Landing
                currentUser={auth.currentUser}
                forums={posts.forums}
                loadingForums={posts.loadingForums}
              />
            )}
          />
          <Route
            path="/explore"
            element={(
              <Explore
                forums={posts.forums}
                posts={posts.posts}
                currentUser={auth.currentUser}
              />
            )}
          />
          <Route
            path="/forum"
            element={(
              <Home
                posts={posts.posts}
                forums={posts.forums}
                pagination={posts.pagination}
                currentFilters={posts.filters}
                loadingPosts={posts.loadingPosts}
                currentUser={auth.currentUser}
                onLoadPosts={posts.loadPosts}
                onLoadForums={posts.loadForums}
                onCreatePost={posts.createPost}
                onAiRewritePostDraft={posts.aiRewritePostDraft}
                onUpdateForumSections={posts.updateForumSections}
                onOwnerRemovePost={posts.ownerRemovePost}
              />
            )}
          />
          <Route
            path="/forum/:forumSlug"
            element={(
              <Home
                posts={posts.posts}
                forums={posts.forums}
                pagination={posts.pagination}
                currentFilters={posts.filters}
                loadingPosts={posts.loadingPosts}
                currentUser={auth.currentUser}
                onLoadPosts={posts.loadPosts}
                onLoadForums={posts.loadForums}
                onCreatePost={posts.createPost}
                onAiRewritePostDraft={posts.aiRewritePostDraft}
                onUpdateForumSections={posts.updateForumSections}
                onOwnerRemovePost={posts.ownerRemovePost}
              />
            )}
          />
          <Route
            path="/forum/:forumSlug/followers"
            element={auth.currentUser ? (
              <ForumFollowersPage
                currentUser={auth.currentUser}
                forums={posts.forums}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/forum/:forumSlug/section/:sectionId"
            element={(
              <Home
                posts={posts.posts}
                forums={posts.forums}
                pagination={posts.pagination}
                currentFilters={posts.filters}
                loadingPosts={posts.loadingPosts}
                currentUser={auth.currentUser}
                onLoadPosts={posts.loadPosts}
                onLoadForums={posts.loadForums}
                onCreatePost={posts.createPost}
                onAiRewritePostDraft={posts.aiRewritePostDraft}
                onUpdateForumSections={posts.updateForumSections}
                onOwnerRemovePost={posts.ownerRemovePost}
              />
            )}
          />
          <Route path="/about" element={<About />} />
          <Route path="/about/why-we-exist" element={<About />} />
          <Route path="/about/leadership" element={<About />} />
          <Route path="/about/leadership/founder" element={<About />} />
          <Route path="/about/leadership/team-members" element={<About />} />
          <Route path="/origin-purpose" element={<OriginPurpose />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/goodbye" element={<Goodbye />} />
          <Route path="/users/:userId" element={<UserProfile currentUser={auth.currentUser} />} />
          <Route
            path="/following"
            element={auth.currentUser ? <Following forums={posts.forums} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/forums/request"
            element={auth.currentUser ? (
              <ForumRequestPage
                currentUser={auth.currentUser}
                onRequestForum={posts.requestForum}
                onAiRewriteForumRequest={posts.aiRewriteForumRequest}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/forums/request/history"
            element={auth.currentUser ? (
              <ForumRequestHistoryPage
                forumWorkspace={posts.forumWorkspace}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/forums/request/:requestId/appeal"
            element={auth.currentUser ? (
              <ForumRequestAppealPage
                forumWorkspace={posts.forumWorkspace}
                loadingWorkspace={posts.loadingForums}
                onAppealForumRequest={posts.appealForumRequest}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/forums/request/review"
            element={canReviewForumRequests ? (
              <ForumRequestReviewPage
                forumWorkspace={posts.forumWorkspace}
                onApproveForumRequest={posts.approveForumRequest}
                onRejectForumRequest={posts.rejectForumRequest}
              />
            ) : (
              <Navigate to="/forum" replace />
            )}
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
                forums={posts.forums}
                onUpdatePost={posts.updatePost}
                onAiRewritePost={posts.aiRewritePost}
                onDeletePost={posts.deletePost}
                onGetMyPosts={posts.getMyPosts}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/my-posts/:postId/appeal"
            element={auth.currentUser ? (
              <PostAppealRecordPage
                mode="author"
                currentUser={auth.currentUser}
                onGetMyPosts={posts.getMyPosts}
                onAppealPost={posts.appealPost}
                onDeletePost={posts.deletePost}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/my-forums"
            element={auth.currentUser ? (
              <MyForums
                currentUser={auth.currentUser}
                forums={posts.forums}
                onLoadForums={posts.loadForums}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/my-forums/invitations"
            element={auth.currentUser ? (
              <MyForumInvitations
                onLoadForums={posts.loadForums}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/my-forums/:forumId/managers/:managerId"
            element={auth.currentUser ? (
              <MyForumManagers
                currentUser={auth.currentUser}
                forums={posts.forums}
                onLoadForums={posts.loadForums}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/moderation"
            element={canModerate ? (
              <Moderation
                currentUser={auth.currentUser}
                forums={posts.forums}
                onGetModerationPosts={posts.getModerationPosts}
              />
            ) : (
              <Navigate to="/forum" replace />
            )}
          />
          <Route
            path="/moderation/posts/:postId/appeal"
            element={canModerate ? (
              <PostAppealRecordPage
                mode="admin"
                currentUser={auth.currentUser}
                onGetModerationPosts={posts.getModerationPosts}
                onReplyToPostAppeal={posts.adminReplyToPostAppeal}
                onPermanentDeletePost={posts.adminPermanentDeletePost}
                onRestorePost={posts.adminRestorePost}
              />
            ) : (
              <Navigate to="/forum" replace />
            )}
          />
          <Route
            path="/analytics"
            element={canViewAnalytics ? (
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
            path="/admin/access"
            element={canManageAdminAccess ? (
              <AdminAccess currentUser={auth.currentUser} />
            ) : (
              <Navigate to="/forum" replace />
            )}
          />
          <Route
            path="/admin/access/:userId"
            element={canManageAdminAccess ? (
              <AdminAccessDetail currentUser={auth.currentUser} />
            ) : (
              <Navigate to="/forum" replace />
            )}
          />
          <Route
            path="/admin/password-reset"
            element={canResetPasswords ? (
              <AdminPasswordReset />
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
                onOwnerRemovePost={posts.ownerRemovePost}
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
