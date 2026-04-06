import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Select from '../components/Select';
import { getSectionLabel } from '../lib/sections';

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Moderation({
  currentUser,
  forums,
  onGetModerationPosts
}) {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [selectedForumFilter, setSelectedForumFilter] = useState('__all__');

  useEffect(() => {
    async function bootstrap() {
      const result = await onGetModerationPosts();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPosts(result.posts || []);
    }
    bootstrap();
  }, [onGetModerationPosts]);

  const manageableForums = useMemo(() => {
    const canModerateSite = Boolean(currentUser?.isAdmin || currentUser?.adminPermissions?.includes('moderation'));
    const sourceForums = canModerateSite
      ? forums
      : forums.filter((forum) => (
        forum.isOwner
        || (forum.currentUserPermissions || []).includes('moderate_posts')
        || (forum.currentUserPermissions || []).includes('review_appeals')
      ));

    return [...sourceForums].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [currentUser, forums]);

  const forumFilterOptions = useMemo(() => ([
    { value: '__all__', label: 'All managed spaces' },
    ...manageableForums.map((forum) => ({
      value: forum.id,
      label: forum.name
    }))
  ]), [manageableForums]);

  const filteredPosts = useMemo(() => (
    selectedForumFilter === '__all__'
      ? posts
      : posts.filter((post) => post.forum?.id === selectedForumFilter)
  ), [posts, selectedForumFilter]);

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-2">Admin</p>
            <h2 className="mb-1 type-title-md">Moderation Queue</h2>
            <p className="type-body mb-0">Restore moderated posts and keep a persistent appeal record with the author.</p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="forum-feed-switcher">
              <Select
                options={forumFilterOptions}
                value={selectedForumFilter}
                onChange={setSelectedForumFilter}
                placeholder="Choose space"
                triggerClassName="forum-feed-switcher-trigger"
                menuClassName="forum-feed-switcher-menu"
              />
            </div>
            <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Feed</Link>
          </div>
        </div>

        {error && (
          <div className="settings-alert is-error mb-3">
            {error}
          </div>
        )}

        <div className="forum-feed">
          {filteredPosts.map((post) => (
            (() => {
              const appealLog = post.moderation?.appealLog || [];
              const latestAppealEntry = appealLog.length > 0 ? appealLog[appealLog.length - 1] : null;
              const canLeaveAdminNote = latestAppealEntry?.authorRole === 'author';
              const appealSummaryStatus = canLeaveAdminNote
                ? 'Reply needed'
                : 'Waiting for author';

              return (
                <article key={post.id} className="forum-post-card moderated-post-card">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <div>
                      <div className="forum-post-kicker mb-2">
                        {post.forum?.name && post.forum?.slug ? (
                          <Link to={`/forum/${post.forum.slug}`} className="forum-origin-chip">
                            <span className="forum-origin-chip-label">Space</span>
                            <span>{post.forum.name}</span>
                          </Link>
                        ) : (
                          <span className="forum-origin-chip is-static">
                            <span className="forum-origin-chip-label">Space</span>
                            <span>{post.forum?.name || 'General'}</span>
                          </span>
                        )}
                        <span className="forum-tag">{getSectionLabel(post.section)}</span>
                      </div>
                      <h5 className="mb-0">{post.title}</h5>
                    </div>
                    <span className="muted">{formatTime(post.moderation.deletedAt)}</span>
                  </div>
                  <p className="muted mb-2">
                    Author: {post.authorName} ({post.authorEmail})
                  </p>
                  <p className="mb-2">{post.content}</p>
                  <div className="moderation-banner mb-3">
                    <strong>Reason:</strong> {post.moderation.deletedReason || 'No reason provided.'}
                    {post.moderation.appealRequestedAt && (
                      <span> Appeal record started on {formatTime(post.moderation.appealRequestedAt)}.</span>
                    )}
                  </div>
                  <section className="appeal-record-strip">
                    <div className="appeal-record-strip-main">
                      <span className="appeal-record-strip-label">Appeal Record</span>
                      <span className="appeal-record-strip-chip">
                        {appealLog.length > 0 ? `${appealLog.length} notes` : 'No notes yet'}
                      </span>
                      {latestAppealEntry?.createdAt && (
                        <span className="appeal-record-strip-chip">
                          Updated {formatTime(latestAppealEntry.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="appeal-record-strip-side">
                      <span className="appeal-record-strip-status">
                        {appealSummaryStatus}
                      </span>
                      <Link to={`/moderation/posts/${post.id}/appeal`} className="forum-secondary-btn text-decoration-none appeal-record-strip-link">
                        Review
                      </Link>
                    </div>
                  </section>
                </article>
              );
            })()
          ))}

          {filteredPosts.length === 0 && (
            <section className="settings-card">
              <h4 className="mb-2">No moderated posts</h4>
              <p className="muted mb-0">
                {selectedForumFilter === '__all__'
                  ? 'The moderation queue is currently empty.'
                  : 'There are no moderated posts for this space right now.'}
              </p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
