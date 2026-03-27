import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildForumDirectory, sortByPopularity, sortByRecentActivity } from '../lib/forumInsights';
import { getSectionLabel } from '../lib/sections';

const OVERVIEW_SLOT_COUNT = 4;

function buildOverviewSlots(forums, placeholderTitle, placeholderCopy) {
  const slots = [...forums];
  while (slots.length < OVERVIEW_SLOT_COUNT) {
    slots.push({
      id: `placeholder-${placeholderTitle}-${slots.length}`,
      isPlaceholder: true,
      placeholderTitle,
      placeholderCopy
    });
  }
  return slots;
}

function ForumOverviewColumn({ title, description, forums, placeholderTitle, placeholderCopy }) {
  const overviewSlots = buildOverviewSlots(forums, placeholderTitle, placeholderCopy);

  return (
    <section className="forum-overview-column">
      <div className="forum-overview-head">
        <h4 className="mb-1 type-title-sm">{title}</h4>
        <p className="muted mb-0">{description}</p>
      </div>

      <div className="forum-overview-list">
        {overviewSlots.map((forum) => (
          forum.isPlaceholder ? (
            <div key={forum.id} className="forum-overview-link is-placeholder">
              <strong>{forum.placeholderTitle}</strong>
              <span className="forum-overview-meta">{forum.placeholderCopy}</span>
            </div>
          ) : (
            <Link key={forum.id || forum.slug} to={`/forum/${forum.slug}`} className="forum-overview-link">
              <div className="forum-overview-link-top">
                <span className="forum-tag">{forum.isFollowing ? 'Following' : forum.isCore ? 'Core Forum' : 'Forum'}</span>
                <span className="muted">{forum.followerCount ?? 0} followers</span>
              </div>
              <strong>{forum.name}</strong>
              <span className="forum-overview-meta">{forum.livePostCount ?? forum.postCount ?? 0} posts</span>
            </Link>
          )
        ))}
      </div>
    </section>
  );
}

export default function Explore({ forums, posts, currentUser }) {
  const forumDirectory = useMemo(() => buildForumDirectory(forums, posts), [forums, posts]);

  const followedForumCards = useMemo(
    () => forumDirectory.filter((forum) => forum.isFollowing).sort(sortByRecentActivity).slice(0, 4),
    [forumDirectory]
  );
  const popularForumCards = useMemo(
    () => [...forumDirectory].sort(sortByPopularity).slice(0, 4),
    [forumDirectory]
  );
  const recentForumCards = useMemo(
    () => [...forumDirectory].sort(sortByRecentActivity).slice(0, 4),
    [forumDirectory]
  );
  const allForums = useMemo(() => {
    return [...forumDirectory].sort((a, b) =>
      Number(Boolean(b.isFollowing)) - Number(Boolean(a.isFollowing))
      || sortByRecentActivity(a, b)
    );
  }, [forumDirectory]);

  return (
    <div className="container page-shell">
      <section className="panel mb-4 forum-view-intro">
        <div className="forum-view-intro-row">
          <div>
            <p className="type-kicker mb-1">Explore</p>
            <h3 className="mb-1 type-title-md">Browse the forum landscape</h3>
            <p className="forum-view-intro-copy mb-0">
              This page is for discovering which forums exist. It highlights followed, popular, and recently updated forums without dropping you into post content first.
            </p>
          </div>
          <Link to="/forum" className="forum-primary-btn text-decoration-none">
            Go to Feed
          </Link>
        </div>
      </section>

      <section className="panel mb-4">
        <div className="forum-sections-head mb-3">
          <div>
            <h3 className="mb-1 type-title-md">Quick Paths</h3>
            <p className="type-body mb-0">
              Use this as a forum directory, then open the forum that looks most relevant.
            </p>
          </div>
          <span className="muted">{forumDirectory.length} forums</span>
        </div>

        <div className="forum-overview-grid">
          <ForumOverviewColumn
            title="Following First"
            description={currentUser ? 'Forums you already follow stay easy to reach.' : 'Login to personalize this lane.'}
            forums={followedForumCards}
            placeholderTitle={currentUser ? 'Follow more forums' : 'Login to personalize'}
            placeholderCopy={currentUser ? 'Save more forums and they will appear here.' : 'Your followed forums will appear here after login.'}
          />
          <ForumOverviewColumn
            title="Popular Now"
            description="High-activity forums with the strongest overall post volume."
            forums={popularForumCards}
            placeholderTitle="More forums soon"
            placeholderCopy="This slot stays reserved so the layout remains aligned."
          />
          <ForumOverviewColumn
            title="Recently Updated"
            description="Forums that moved most recently, useful when you want fresh activity."
            forums={recentForumCards}
            placeholderTitle="Waiting for updates"
            placeholderCopy="Newly active forums will appear here as the community grows."
          />
        </div>
      </section>

      <section className="panel">
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
                {(forum.sectionScope || []).slice(0, 4).map((section) => (
                  <span key={`${forum.id}-${section}`} className="forum-tag">
                    {getSectionLabel(section)}
                  </span>
                ))}
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
  );
}
