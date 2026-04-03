import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ForumSectionPills from '../components/ForumSectionPills';
import { buildForumDirectory, sortByPopularity, sortByRecentActivity } from '../lib/forumInsights';

export default function Explore({ forums, posts, currentUser }) {
  void currentUser;
  const forumDirectory = useMemo(() => buildForumDirectory(forums, posts), [forums, posts]);
  const followedForumCount = useMemo(
    () => forumDirectory.filter((forum) => forum.isFollowing).length,
    [forumDirectory]
  );
  const sectionCount = useMemo(() => (
    new Set(forumDirectory.flatMap((forum) => forum.sectionScope || []).filter(Boolean)).size
  ), [forumDirectory]);

  const popularForumCards = useMemo(
    () => [...forumDirectory].sort(sortByPopularity).slice(0, 6),
    [forumDirectory]
  );
  const allForums = useMemo(() => {
    return [...forumDirectory].sort((a, b) =>
      Number(Boolean(b.isFollowing)) - Number(Boolean(a.isFollowing))
      || sortByRecentActivity(a, b)
    );
  }, [forumDirectory]);
  const loopingTrendingCards = useMemo(() => (
    popularForumCards.length > 1
      ? [...popularForumCards, ...popularForumCards]
      : popularForumCards
  ), [popularForumCards]);

  return (
    <div className="container page-shell">
      <section className="panel mb-4 forum-view-intro explore-hero-shell">
        <div className="forum-view-intro-row">
          <div className="forum-view-intro-main">
            <div className="forum-view-intro-copy-block">
              <div className="forum-view-intro-kicker-row">
                <p className="type-kicker mb-0">Explore</p>
                <span className="forum-view-intro-status-pill">Directory</span>
              </div>
              <h3 className="mb-1 type-title-md">Browse the forum landscape</h3>
              <p className="forum-view-intro-copy mb-0">
                Discover forums, see what's active, and jump into the right community.
              </p>

              <div className="forum-view-intro-meta-row">
                <span className="forum-view-intro-badge">
                  <strong>{forumDirectory.length}</strong>
                  <span>Total forums</span>
                </span>
                <span className="forum-view-intro-badge">
                  <strong>{followedForumCount}</strong>
                  <span>Following</span>
                </span>
                <span className="forum-view-intro-badge">
                  <strong>{sectionCount}</strong>
                  <span>Sections</span>
                </span>
              </div>
            </div>
          </div>
          <div className="forum-view-intro-actions">
            <Link to="/forum" className="explore-intro-link text-decoration-none">
              <span className="explore-intro-link-kicker">Back to Feed</span>
              <strong>Forum Feed</strong>
              <span className="explore-intro-link-copy">Return to the live cross-forum stream.</span>
              <span className="explore-intro-link-footer">
                <span>Live posts</span>
                <span className="explore-intro-link-arrow" aria-hidden="true">↗</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      <div className="forum-layout">
        <div className="forum-main forum-main-full">
          <section className="panel mb-4 explore-panel-shell explore-panel-trending">
            <div className="forum-sections-head mb-3">
              <div>
                <h3 className="mb-1 type-title-md">Trending</h3>
                <p className="type-body mb-0">
                  The busiest forums right now, arranged in a fast horizontal lane.
                </p>
              </div>
              <span className="muted">{popularForumCards.length} featured</span>
            </div>

            {popularForumCards.length ? (
              <div className="explore-trending-marquee">
                <div className={`explore-trending-row ${popularForumCards.length > 1 ? 'is-animated' : ''}`.trim()}>
                  {loopingTrendingCards.map((forum, index) => {
                    const isClone = popularForumCards.length > 1 && index >= popularForumCards.length;
                    const displayIndex = (index % popularForumCards.length) + 1;

                    return (
                      <Link
                        key={`${forum.id || forum.slug}-${isClone ? 'clone' : 'primary'}-${index}`}
                        to={`/forum/${forum.slug}`}
                        className="explore-trending-card"
                        aria-hidden={isClone ? 'true' : undefined}
                        tabIndex={isClone ? -1 : undefined}
                      >
                        <div className="explore-trending-card-head">
                          <span className="explore-trending-rank">{String(displayIndex).padStart(2, '0')}</span>
                          <span className="forum-tag">{forum.isFollowing ? 'Following' : forum.isCore ? 'Core Forum' : 'Community Forum'}</span>
                        </div>
                        <strong>{forum.name}</strong>
                        <p className="explore-trending-copy mb-0">
                          {forum.description || 'Open this forum to see the latest posts and active discussions.'}
                        </p>
                        <ForumSectionPills
                          sections={forum.sectionScope || []}
                          visibleCount={2}
                          className="explore-trending-pill-group"
                        />
                        <div className="explore-trending-meta">
                          <span>{forum.livePostCount ?? forum.postCount ?? 0} posts</span>
                          <span>{forum.followerCount ?? 0} followers</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <section className="settings-card">
                <h4 className="mb-2">No trending forums yet</h4>
                <p className="muted mb-0">This lane will fill in as forum activity grows.</p>
              </section>
            )}
          </section>

          <section className="panel explore-panel-shell explore-panel-directory">
            <div className="forum-sections-head mb-3">
              <div>
                <h3 className="mb-1 type-title-md">All Forums</h3>
                <p className="type-body mb-0">
                  A directory view of every available forum, with sections and recent activity at a glance.
                </p>
              </div>
            </div>

            <div className="explore-forum-grid">
              {allForums.map((forum) => (
                <Link key={forum.id || forum.slug} to={`/forum/${forum.slug}`} className="explore-forum-card">
                  <div className="explore-forum-card-top">
                    <div className="forum-post-kicker">
                      <span className="forum-mini-link is-static">{forum.name}</span>
                      <span className="forum-tag">{forum.isFollowing ? 'Following' : forum.isCore ? 'Core Forum' : 'Community Forum'}</span>
                    </div>
                  </div>

                  <p className="explore-forum-copy mb-0">
                    {forum.description || 'Open this forum to see the post feed.'}
                  </p>

                  <div className="explore-forum-sections">
                    <ForumSectionPills
                      sections={forum.sectionScope || []}
                      visibleCount={3}
                      className="explore-section-pill-group"
                    />
                  </div>

                  <div className="explore-forum-footer">
                    <span>{forum.livePostCount ?? forum.postCount ?? 0} posts</span>
                    <span>{forum.followerCount ?? 0} followers</span>
                    <span>Open forum</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
