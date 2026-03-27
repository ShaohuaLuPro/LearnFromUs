export function getPostActivityAt(post) {
  return Number(post?.updatedAt || post?.createdAt || 0);
}

export function sortByRecentActivity(a, b) {
  return (Number(b.latestActivityAt || 0) - Number(a.latestActivityAt || 0))
    || ((b.livePostCount ?? b.postCount ?? 0) - (a.livePostCount ?? a.postCount ?? 0))
    || String(a.name || '').localeCompare(String(b.name || ''));
}

export function sortByPopularity(a, b) {
  return ((b.livePostCount ?? b.postCount ?? 0) - (a.livePostCount ?? a.postCount ?? 0))
    || (Number(b.latestActivityAt || 0) - Number(a.latestActivityAt || 0))
    || String(a.name || '').localeCompare(String(b.name || ''));
}

export function buildForumDirectory(forums = [], posts = []) {
  const forumMap = new Map();

  for (const forum of forums) {
    forumMap.set(forum.id || forum.slug, {
      id: forum.id || '',
      slug: forum.slug || '',
      name: forum.name || '',
      description: forum.description || '',
      ownerId: forum.ownerId || null,
      sectionScope: forum.sectionScope || [],
      postCount: Number(forum.postCount || 0),
      livePostCount: Number(forum.livePostCount || forum.postCount || 0),
      followerCount: Number(forum.followerCount || 0),
      isCore: Boolean(forum.isCore),
      isFollowing: Boolean(forum.isFollowing),
      latestActivityAt: 0,
      visiblePostCount: 0
    });
  }

  for (const post of posts) {
    const forum = post.forum;
    if (!forum?.id && !forum?.slug) {
      continue;
    }

    const key = forum.id || forum.slug;
    const existing = forumMap.get(key) || {
      id: forum.id || '',
      slug: forum.slug || '',
      name: forum.name || '',
      description: forum.description || '',
      ownerId: forum.ownerId || null,
      sectionScope: forum.sectionScope || [],
      postCount: 0,
      livePostCount: 0,
      followerCount: Number(forum.followerCount || 0),
      isCore: Boolean(forum.isCore),
      isFollowing: Boolean(forum.isFollowing),
      latestActivityAt: 0,
      visiblePostCount: 0
    };

    const activityAt = getPostActivityAt(post);
    existing.latestActivityAt = Math.max(existing.latestActivityAt, activityAt);
    existing.visiblePostCount += 1;
    existing.livePostCount = Math.max(existing.livePostCount, existing.visiblePostCount);

    forumMap.set(key, existing);
  }

  return [...forumMap.values()];
}

export function getFeedScore(post, forumInsight, now) {
  const postActivityAt = getPostActivityAt(post);
  const postAgeHours = Math.max(0, (now - postActivityAt) / 36e5);
  const postRecencyScore = Math.max(0, 240 - Math.min(postAgeHours, 240));
  const popularityScore = Math.log2((forumInsight?.livePostCount ?? forumInsight?.postCount ?? 0) + 1) * 18;
  const followScore = forumInsight?.isFollowing ? 160 : 0;
  const forumFreshness = forumInsight?.latestActivityAt
    ? Math.max(0, 120 - Math.min((now - forumInsight.latestActivityAt) / 36e5, 120)) * 0.35
    : 0;

  return followScore + postRecencyScore + popularityScore + forumFreshness;
}
