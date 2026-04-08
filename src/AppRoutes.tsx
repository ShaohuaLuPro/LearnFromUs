import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AgentChatbox from './components/AgentChatbox';
import Footer from './components/Footer';
import Header from './components/Header';
import RouteSeo from './components/RouteSeo';
import ScrollToTop from './components/ScrollToTop';
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
import MySpaceManage from './pages/MySpaceManage';
import MyPostEditPage from './pages/MyPostEditPage';
import MyPosts from './pages/MyPosts';
import PostAppealRecordPage from './pages/PostAppealRecordPage';
import PostDetail from './pages/PostDetail';
import Privacy from './pages/Privacy';
import SavedPosts from './pages/SavedPosts';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
import UserProfile from './pages/UserProfile';

function RoutePendingState() {
  return (
    <div className="container page-shell">
      <div className="panel">
        <p className="muted mb-0">Loading...</p>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  const auth = useAuth();
  const posts = usePosts();
  const location = useLocation();
  const authPendingElement = <RoutePendingState />;
  const canManageAdminAccess = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.canManageAdminAccess);
  const canModerate = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('moderation'));
  const canViewAnalytics = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('analytics'));
  const canReviewForumRequests = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('forum_requests'));
  const canResetPasswords = Boolean(auth.currentUser?.isAdmin || auth.currentUser?.adminPermissions?.includes('password_reset'));
  const showMainFooter = (
    location.pathname === '/'
    || location.pathname === '/origin-purpose'
    || location.pathname === '/terms'
    || location.pathname === '/privacy'
    || location.pathname === '/legal'
    || location.pathname === '/goodbye'
    || location.pathname.startsWith('/about')
  );

  const requireUser = (element: React.ReactNode) => {
    if (auth.authLoading) {
      return authPendingElement;
    }
    return auth.currentUser ? element : <Navigate to="/login" replace />;
  };

  const requireCapability = (allowed: boolean, element: React.ReactNode, redirectTo = '/forum') => {
    if (auth.authLoading) {
      return authPendingElement;
    }
    return allowed ? element : <Navigate to={redirectTo} replace />;
  };

  const requireGuest = (element: React.ReactNode) => {
    if (auth.authLoading) {
      return authPendingElement;
    }
    return auth.currentUser ? <Navigate to="/forum" replace /> : element;
  };

  const updateProfile = async (
    { name, bio, avatarAssetId, removeAvatar }: { name: string; bio?: string; avatarAssetId?: string; removeAvatar?: boolean }
  ) => {
    const result = await auth.updateProfile({ name, bio, avatarAssetId, removeAvatar });
    if (result.ok && result.user) {
      posts.syncAuthorName(result.user.id, result.user.name, result.user.avatarUrl || '');
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
    <div className="app-wrapper app-platform">
      <RouteSeo />
      <ScrollToTop />
      <Header
        currentUser={auth.currentUser}
        forums={posts.forums}
        posts={posts.posts}
        onLogout={auth.logout}
        showSidebarFooter={!showMainFooter}
      />
      <div className="app-platform-main-column">
        <main className="app-main app-main-platform">
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
                onLoadForums={posts.loadForums}
                onGetRecommendedPosts={posts.getRecommendedPosts}
                onToggleLike={posts.setPostLike}
                onToggleBookmark={posts.setPostBookmark}
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
                onToggleLike={posts.setPostLike}
                onToggleBookmark={posts.setPostBookmark}
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
                onToggleLike={posts.setPostLike}
                onToggleBookmark={posts.setPostBookmark}
              />
            )}
          />
          <Route
            path="/forum/:forumSlug/followers"
            element={requireUser(
              <ForumFollowersPage
                currentUser={auth.currentUser}
                forums={posts.forums}
              />
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
                onToggleLike={posts.setPostLike}
                onToggleBookmark={posts.setPostBookmark}
              />
            )}
          />
          <Route path="/about" element={<About />} />
          <Route path="/about/team" element={<About />} />
          <Route path="/about/founder" element={<About />} />
          <Route path="/about/ben-he" element={<About />} />
          <Route path="/about/sally-huang" element={<About />} />
          <Route path="/about/guotian-kan" element={<About />} />
          <Route path="/about/why-we-exist" element={<Navigate to="/origin-purpose" replace />} />
          <Route path="/about/leadership" element={<Navigate to="/about/team" replace />} />
          <Route path="/about/leadership/founder" element={<Navigate to="/about/founder" replace />} />
          <Route path="/about/leadership/team-members" element={<Navigate to="/about/ben-he" replace />} />
          <Route path="/about/leadership/sally-huang" element={<Navigate to="/about/sally-huang" replace />} />
          <Route path="/about/leadership/guotian-kan" element={<Navigate to="/about/guotian-kan" replace />} />
          <Route path="/origin-purpose" element={<OriginPurpose />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/goodbye" element={<Goodbye />} />
          <Route
            path="/users/:userId"
            element={<UserProfile currentUser={auth.currentUser} forums={posts.forums} />}
          />
          <Route
            path="/following"
            element={requireUser(
              <Following
                forums={posts.forums}
                currentUser={auth.currentUser}
                onLoadForums={posts.loadForums}
              />
            )}
          />
          <Route
            path="/saved"
            element={requireUser(
              <SavedPosts
                currentUser={auth.currentUser}
                onGetSavedPosts={posts.getSavedPosts}
                onToggleLike={posts.setPostLike}
                onToggleBookmark={posts.setPostBookmark}
              />
            )}
          />
          <Route
            path="/forums/request"
            element={requireUser(
              <ForumRequestPage
                currentUser={auth.currentUser}
                onRequestForum={posts.requestForum}
                onAiRewriteForumRequest={posts.aiRewriteForumRequest}
              />
            )}
          />
          <Route
            path="/forums/request/history"
            element={requireUser(
              <ForumRequestHistoryPage
                forumWorkspace={posts.forumWorkspace}
              />
            )}
          />
          <Route
            path="/forums/request/:requestId/appeal"
            element={requireUser(
              <ForumRequestAppealPage
                forumWorkspace={posts.forumWorkspace}
                loadingWorkspace={posts.loadingForums}
                onAppealForumRequest={posts.appealForumRequest}
              />
            )}
          />
          <Route
            path="/forums/request/review"
            element={requireCapability(
              canReviewForumRequests,
              <ForumRequestReviewPage
                forumWorkspace={posts.forumWorkspace}
                onApproveForumRequest={posts.approveForumRequest}
                onRejectForumRequest={posts.rejectForumRequest}
              />
            )}
          />
          <Route
            path="/settings"
            element={requireUser(
              <Settings
                currentUser={auth.currentUser}
                onUpdateProfile={updateProfile}
                onUpdatePassword={auth.updatePassword}
                onDeleteAccount={deleteAccount}
              />
            )}
          />
          <Route
            path="/my-posts"
            element={requireUser(
              <MyPosts
                currentUser={auth.currentUser}
                onGetMyPosts={posts.getMyPosts}
                onDeletePost={posts.deletePost}
              />
            )}
          />
          <Route
            path="/my-posts/:postId/edit"
            element={requireUser(
              <MyPostEditPage
                currentUser={auth.currentUser}
                forums={posts.forums}
                onUpdatePost={posts.updatePost}
                onAiRewritePost={posts.aiRewritePost}
                onDeletePost={posts.deletePost}
                onGetMyPosts={posts.getMyPosts}
              />
            )}
          />
          <Route
            path="/my-posts/:postId/appeal"
            element={requireUser(
              <PostAppealRecordPage
                mode="author"
                currentUser={auth.currentUser}
                onGetMyPosts={posts.getMyPosts}
                onAppealPost={posts.appealPost}
                onDeletePost={posts.deletePost}
              />
            )}
          />
          <Route
            path="/my-spaces"
            element={requireUser(
              <MyForums
                currentUser={auth.currentUser}
                forums={posts.forums}
                onLoadForums={posts.loadForums}
              />
            )}
          />
          <Route
            path="/my-spaces/invitations"
            element={requireUser(
              <MyForumInvitations
                currentUser={auth.currentUser}
                forums={posts.forums}
                posts={posts.posts}
                onLoadForums={posts.loadForums}
              />
            )}
          />
          <Route
            path="/my-spaces/:forumId/managers/:managerId"
            element={requireUser(
              <MyForumManagers
                currentUser={auth.currentUser}
                forums={posts.forums}
                onLoadForums={posts.loadForums}
              />
            )}
          />
          <Route
            path="/my-spaces/:spaceId/manage"
            element={requireUser(
              <MySpaceManage
                currentUser={auth.currentUser}
                forums={posts.forums}
                onLoadForums={posts.loadForums}
              />
            )}
          />
          <Route path="/my-forums" element={<Navigate to="/my-spaces" replace />} />
          <Route path="/my-forums/invitations" element={<Navigate to="/my-spaces/invitations" replace />} />
          <Route
            path="/my-forums/:forumId/managers/:managerId"
            element={requireUser(
              <MyForumManagers
                currentUser={auth.currentUser}
                forums={posts.forums}
                onLoadForums={posts.loadForums}
              />
            )}
          />
          <Route
            path="/my-forums/:forumId/manage"
            element={requireUser(
              <MySpaceManage
                currentUser={auth.currentUser}
                forums={posts.forums}
                onLoadForums={posts.loadForums}
              />
            )}
          />
          <Route
            path="/moderation"
            element={requireCapability(
              canModerate,
              <Moderation
                currentUser={auth.currentUser}
                forums={posts.forums}
                onGetModerationPosts={posts.getModerationPosts}
              />
            )}
          />
          <Route
            path="/moderation/posts/:postId/appeal"
            element={requireCapability(
              canModerate,
              <PostAppealRecordPage
                mode="admin"
                currentUser={auth.currentUser}
                onGetModerationPosts={posts.getModerationPosts}
                onReplyToPostAppeal={posts.adminReplyToPostAppeal}
                onPermanentDeletePost={posts.adminPermanentDeletePost}
                onRestorePost={posts.adminRestorePost}
              />
            )}
          />
          <Route
            path="/analytics"
            element={requireCapability(
              canViewAnalytics,
              <Analytics
                onQueryAdminAnalytics={posts.queryAdminAnalytics}
                onGetParquetDatasets={posts.getAdminParquetDatasets}
                onDownloadParquetDataset={posts.downloadAdminParquetDataset}
              />
            )}
          />
          <Route
            path="/admin/access"
            element={requireCapability(
              canManageAdminAccess,
              <AdminAccess currentUser={auth.currentUser} />
            )}
          />
          <Route
            path="/admin/access/:userId"
            element={requireCapability(
              canManageAdminAccess,
              <AdminAccessDetail currentUser={auth.currentUser} />
            )}
          />
          <Route
            path="/admin/password-reset"
            element={requireCapability(
              canResetPasswords,
              <AdminPasswordReset />
            )}
          />
          <Route
            path="/login"
            element={requireGuest(
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
                onToggleLike={posts.setPostLike}
                onToggleBookmark={posts.setPostBookmark}
                onGetComments={posts.getComments}
                onCreateComment={posts.createComment}
              />
            )}
          />
          </Routes>
        </main>
        {showMainFooter ? <Footer /> : null}
      </div>
      <AgentChatbox
        currentUser={auth.currentUser}
        onAgentChat={posts.agentChat}
        onCreatePost={posts.createPost}
      />
    </div>
  );
}
