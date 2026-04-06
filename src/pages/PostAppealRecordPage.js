import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppealConversation from '../components/AppealConversation';
import MarkdownBlock from '../components/MarkdownBlock';
import { getSectionLabel } from '../lib/sections';

const APPEAL_MESSAGE_LIMIT = 200;

function formatTime(timestamp) {
  if (!timestamp) {
    return 'Unknown time';
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function PostAppealRecordPage(props) {
  const {
    mode,
    currentUser,
    onGetMyPosts,
    onGetModerationPosts,
    onAppealPost,
    onReplyToPostAppeal,
    onPermanentDeletePost,
    onRestorePost,
    onDeletePost
  } = props;
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdminView = mode === 'admin';

  const loadPost = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      setError('Post not found.');
      return;
    }

    setLoading(true);
    setError('');

    const result = isAdminView
      ? await onGetModerationPosts?.()
      : await onGetMyPosts?.();

    if (!result?.ok) {
      setLoading(false);
      setError(result?.message || 'Failed to load appeal record.');
      return;
    }

    const nextPost = (result.posts || []).find((entry) => entry.id === postId) || null;
    setPost(nextPost);
    setLoading(false);

    if (!nextPost) {
      setError(isAdminView ? 'This moderated post is no longer available in the queue.' : 'This post could not be found in your list.');
    }
  }, [isAdminView, onGetModerationPosts, onGetMyPosts, postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const appealLog = post?.moderation?.appealLog || [];
  const latestAppealEntry = appealLog.length > 0 ? appealLog[appealLog.length - 1] : null;
  const isModerated = Boolean(post?.moderation?.isDeleted);
  const isPermanentlyDeleted = Boolean(post?.moderation?.isPermanentlyDeleted);

  const canLeaveAppealMessage = !isAdminView && isModerated && !isPermanentlyDeleted && latestAppealEntry?.authorRole !== 'author';
  const canLeaveAdminNote = isAdminView && latestAppealEntry?.authorRole === 'author';

  const helperText = useMemo(() => {
    if (isAdminView) {
      return canLeaveAdminNote
        ? 'One saved admin note per appeal round. This note can also be used for a permanent delete decision.'
        : 'There is no new user appeal waiting right now. You can still leave a final permanent delete note.';
    }

    return canLeaveAppealMessage
      ? 'One saved appeal note per round. After an admin reply, you can leave another one.'
      : latestAppealEntry?.authorRole === 'author'
        ? 'Your latest appeal note is already saved. Wait for an admin reply before leaving another one.'
        : 'Appeal notes stay saved in this record.';
  }, [canLeaveAdminNote, canLeaveAppealMessage, isAdminView, latestAppealEntry]);

  const backPath = isAdminView ? '/moderation' : '/my-posts';

  const submitAuthorAppeal = async () => {
    const trimmed = String(note || '').trim();
    if (!trimmed) {
      setError('Leave an appeal message before submitting.');
      return;
    }

    setError('');
    setMessage('');
    const result = await onAppealPost(post.id, trimmed);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || 'Appeal note saved.');
    setNote('');
    await loadPost();
  };

  const submitAdminNote = async () => {
    const trimmed = String(note || '').trim();
    if (!trimmed) {
      setError('Add an admin note before saving.');
      return;
    }

    setError('');
    setMessage('');
    const result = await onReplyToPostAppeal(post.id, trimmed);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || 'Admin note saved.');
    setNote('');
    await loadPost();
  };

  const permanentDelete = async () => {
    const trimmed = String(note || '').trim();
    setError('');
    setMessage('');
    const result = await onPermanentDeletePost(post.id, trimmed);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || 'Post permanently deleted.');
    setNote('');
    navigate('/moderation');
  };

  const restorePost = async () => {
    setError('');
    setMessage('');
    const result = await onRestorePost(post.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || 'Post restored.');
    navigate('/moderation');
  };

  const deletePost = async () => {
    setError('');
    setMessage('');
    const result = await onDeletePost(post.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate('/my-posts');
  };

  if (loading) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <p className="muted mb-0">Loading appeal record...</p>
        </section>
      </div>
    );
  }

  if (!currentUser || !post) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">Appeal Record</h2>
          <p className="muted mb-3">{error || 'This appeal record is unavailable.'}</p>
          <Link to={backPath} className="forum-secondary-btn text-decoration-none">Back</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <div className="appeal-record-shell">
        <section className="panel appeal-record-panel">
          <div className="appeal-record-head">
            <div>
              <p className="type-kicker mb-2">{isAdminView ? 'Admin' : 'Workspace'}</p>
              <h2 className="mb-1 type-title-md">Appeal Record</h2>
              <p className="type-body mb-0">Review the full moderation trail, saved notes, and the current decision on this post.</p>
            </div>
              <div className="forum-actions">
              {!isAdminView && !isPermanentlyDeleted && (
                <Link to={`/my-posts/${post.id}/edit`} className="forum-secondary-btn text-decoration-none">Edit Post</Link>
              )}
              <Link to={backPath} className="forum-secondary-btn text-decoration-none">Back</Link>
            </div>
          </div>

          {(message || error) && (
            <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-0`}>
              {error || message}
            </div>
          )}
        </section>

        <div className="appeal-record-layout">
          <section className="settings-card appeal-record-post-card">
            <div className="forum-post-kicker mb-3">
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

            <h3 className="post-detail-title appeal-record-post-title mb-2">{post.title}</h3>
            <p className="muted mb-3">
              {isAdminView ? `Author: ${post.authorName} (${post.authorEmail})` : `Created ${formatTime(post.createdAt)}`}
            </p>

            <div className={`moderation-banner mb-3 ${isPermanentlyDeleted ? 'is-danger' : ''}`}>
              <strong>{isPermanentlyDeleted ? 'Permanently deleted by admin.' : isModerated ? 'Removed by admin.' : 'Moderation history.'}</strong>{' '}
              {isPermanentlyDeleted
                ? (post.moderation.permanentDeleteNote || post.moderation.deletedReason || 'No final decision note provided.')
                : (post.moderation.deletedReason || 'No reason provided.')}
              {post.moderation.appealRequestedAt && !isPermanentlyDeleted && (
                <span> Appeal record started on {formatTime(post.moderation.appealRequestedAt)}.</span>
              )}
              {post.moderation.permanentlyDeletedAt && (
                <span> Finalized on {formatTime(post.moderation.permanentlyDeletedAt)}.</span>
              )}
            </div>

            <div className="appeal-record-post-body">
              <MarkdownBlock content={post.content} className="post-detail-content" />
            </div>
          </section>

          <section className="settings-card appeal-record-thread-card">
            <div className="appeal-record-thread-head">
              <div>
                <h4 className="mb-1">Saved Notes</h4>
                <p className="muted mb-0">{appealLog.length} entries in this appeal record.</p>
              </div>
            </div>

            <AppealConversation
              messages={appealLog}
              viewerRole={isAdminView ? 'admin' : 'author'}
              emptyLabel="No appeal messages yet."
              composerLabel={isAdminView ? 'Admin note' : 'Leave appeal message'}
              composerPlaceholder={isAdminView
                ? 'Leave a review note, or write the final reason if you want to permanently delete this post.'
                : 'Explain why this post should be restored. Your message will be kept in this appeal record.'}
              composerValue={note}
              onComposerChange={
                (isAdminView || canLeaveAppealMessage)
                  ? setNote
                  : undefined
              }
              onSubmit={
                isAdminView
                  ? submitAdminNote
                  : canLeaveAppealMessage
                    ? submitAuthorAppeal
                    : undefined
              }
              submitLabel={isAdminView ? 'Leave Note' : 'Leave Message'}
              submitDisabled={
                isAdminView
                  ? (!canLeaveAdminNote || !String(note || '').trim())
                  : !String(note || '').trim()
              }
              maxLength={(isAdminView || canLeaveAppealMessage) ? APPEAL_MESSAGE_LIMIT : undefined}
              helperText={helperText}
            />

            <div className="forum-actions mt-3">
              {isAdminView ? (
                <>
                  <button type="button" className="forum-primary-btn" onClick={restorePost}>
                    Restore Post
                  </button>
                  <button type="button" className="forum-danger-btn" onClick={permanentDelete}>
                    Permanent Delete
                  </button>
                </>
              ) : (
                isPermanentlyDeleted && (
                  <button type="button" className="forum-danger-btn" onClick={deletePost}>
                    Delete Post
                  </button>
                )
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
