import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiAcceptForumManagerInvite,
  apiGetFollowing,
  apiGetForumManagerInvites,
  apiGetForums,
  apiGetMyPosts,
  apiGetPosts,
  apiRejectForumManagerInvite,
  apiSearchUsers
} from '../api';
import Avatar from '../components/Avatar';
import { authStorage } from '../lib/authStorage';

const INBOX_SECTION_OPTIONS = [
  { value: 'system', label: 'System', hint: 'Platform updates and activity' },
  { value: 'requests', label: 'Requests', hint: 'Pending message requests' },
  { value: 'direct', label: 'Messages', hint: 'Direct messages' }
];

const SYSTEM_FILTER_OPTIONS = [
  { value: 'all', label: 'All updates' },
  { value: 'activity', label: 'Activity' },
  { value: 'social', label: 'Social' },
  { value: 'invitations', label: 'Invitations' },
  { value: 'admin', label: 'Admin' },
  { value: 'spaces', label: 'Spaces' }
];

const CATEGORY_LABELS = {
  activity: 'Activity',
  social: 'Social',
  invitations: 'Invitation',
  admin: 'Admin',
  spaces: 'Space'
};

const FORUM_PERMISSION_LABELS = {
  manage_admins: 'Manage Admins',
  manage_sections: 'Manage Sections',
  view_followers: 'View Followers',
  moderate_posts: 'Delete Posts',
  review_appeals: 'Review Appeals',
  publish_announcements: 'Publish Announcements'
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function formatTimestamp(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) {
    return 'Recently';
  }
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCount(value) {
  const count = Number(value || 0);
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

function getPostPreview(content) {
  const text = String(content || '')
    .replace(/!\[[^\]]*]\((.*?)\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 120) {
    return text;
  }
  return `${text.slice(0, 120).trimEnd()}...`;
}

function isManagementLikeSpace(name = '') {
  const normalized = normalizeText(name);
  return normalized.includes('management') || normalized.includes('admin') || normalized.includes('ops');
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getInboxStorageKey(userId) {
  return `tsumit.inbox.state.${String(userId || '').trim()}`;
}

function loadInboxState(userId) {
  const fallback = { readAtByThread: {}, requestByUserId: {}, directByUserId: {} };
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(getInboxStorageKey(userId));
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }
    return {
      readAtByThread: parsed.readAtByThread && typeof parsed.readAtByThread === 'object' ? parsed.readAtByThread : {},
      requestByUserId: parsed.requestByUserId && typeof parsed.requestByUserId === 'object' ? parsed.requestByUserId : {},
      directByUserId: parsed.directByUserId && typeof parsed.directByUserId === 'object' ? parsed.directByUserId : {}
    };
  } catch (_) {
    return fallback;
  }
}

function saveInboxState(userId, nextState) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(getInboxStorageKey(userId), JSON.stringify(nextState || {}));
  } catch (_) {
    // Ignore storage errors.
  }
}

function safeMessageList(input) {
  return Array.isArray(input)
    ? input
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id || createId('dm')),
        senderId: String(item.senderId || ''),
        content: String(item.content || '').trim(),
        timestamp: Number(item.timestamp || 0)
      }))
      .filter((item) => item.content)
      .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
    : [];
}

function markThreadAsRead(prevState, threadId, timestamp) {
  const currentRead = Number(prevState.readAtByThread?.[threadId] || 0);
  const nextRead = Math.max(currentRead, Number(timestamp || Date.now()));
  if (nextRead === currentRead) {
    return prevState;
  }
  return {
    ...prevState,
    readAtByThread: {
      ...prevState.readAtByThread,
      [threadId]: nextRead
    }
  };
}

function NotificationActor({ notification }) {
  if (notification.actorType === 'user') {
    return (
      <Avatar
        imageUrl={notification.actorAvatarUrl}
        name={notification.actorName}
        size={36}
        className="notification-item-avatar"
      />
    );
  }
  if (notification.actorType === 'space') {
    return (
      <span className="notification-item-space-avatar" aria-hidden="true">
        {String(notification.actorName || '').trim().charAt(0).toUpperCase() || 'S'}
      </span>
    );
  }
  return <span className="notification-item-system-avatar" aria-hidden="true">!</span>;
}

function ThreadAvatar({ thread }) {
  if (thread.kind === 'direct' || thread.kind === 'request') {
    return <Avatar imageUrl={thread.avatarUrl} name={thread.title} size={36} className="inbox-thread-avatar" />;
  }
  if (thread.kind === 'support') {
    return <span className="inbox-thread-avatar-fallback is-support" aria-hidden="true">S</span>;
  }
  return <span className="inbox-thread-avatar-fallback is-system" aria-hidden="true">T</span>;
}

export default function MyForumInvitations({
  currentUser,
  forums = [],
  posts = [],
  onLoadForums
}) {
  const [invites, setInvites] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [followingPosts, setFollowingPosts] = useState([]);
  const [recentPublicPosts, setRecentPublicPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [myForumRequests, setMyForumRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('system');
  const [threadQuery, setThreadQuery] = useState('');
  const [systemFilter, setSystemFilter] = useState('all');
  const [selectedThreadId, setSelectedThreadId] = useState('thread-system');
  const [selectedSystemItemId, setSelectedSystemItemId] = useState('');
  const [directDraft, setDirectDraft] = useState('');
  const [requestComposerOpen, setRequestComposerOpen] = useState(false);
  const [requestTargetQuery, setRequestTargetQuery] = useState('');
  const [requestTargetResults, setRequestTargetResults] = useState([]);
  const [requestSearching, setRequestSearching] = useState(false);
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestDraft, setRequestDraft] = useState('');
  const [inboxState, setInboxState] = useState(() => loadInboxState(currentUser?.id));

  useEffect(() => {
    setInboxState(loadInboxState(currentUser?.id));
  }, [currentUser?.id]);

  useEffect(() => {
    saveInboxState(currentUser?.id, inboxState);
  }, [currentUser?.id, inboxState]);

  useEffect(() => {
    let cancelled = false;

    async function loadInboxData() {
      const token = authStorage.getToken();
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          setError('Please login first.');
        }
        return;
      }

      setLoading(true);
      setError('');
      try {
        await onLoadForums?.();

        const [inviteData, followingData, publicPostsData, myPostsData, forumData] = await Promise.all([
          apiGetForumManagerInvites(token),
          apiGetFollowing(token),
          apiGetPosts({ page: 1, pageSize: 80 }),
          apiGetMyPosts(token),
          apiGetForums(token)
        ]);

        if (cancelled) {
          return;
        }

        setInvites(inviteData.invites || []);
        setFollowers(followingData.followers || []);
        setFollowingUsers(followingData.following || followingData.users || []);
        setFollowingPosts(followingData.posts || []);
        setRecentPublicPosts(publicPostsData.posts || []);
        setMyPosts(myPostsData.posts || []);
        setMyForumRequests(forumData.workspace?.myRequests || []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load inbox.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInboxData();
    return () => {
      cancelled = true;
    };
  }, [onLoadForums]);

  useEffect(() => {
    let cancelled = false;
    const token = authStorage.getToken();
    const cleanQuery = String(requestTargetQuery || '').trim();

    if (!requestComposerOpen || cleanQuery.length < 2 || !token) {
      setRequestTargetResults([]);
      setRequestSearching(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setRequestSearching(true);
      try {
        const data = await apiSearchUsers(cleanQuery, 6, token);
        if (cancelled) {
          return;
        }
        setRequestTargetResults((data.users || []).filter((item) => String(item.id) !== String(currentUser?.id || '')));
      } catch (_) {
        if (!cancelled) {
          setRequestTargetResults([]);
        }
      } finally {
        if (!cancelled) {
          setRequestSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentUser?.id, requestComposerOpen, requestTargetQuery]);

  const trackedSpaceMap = useMemo(() => {
    const map = new Map();
    forums.forEach((forum) => {
      const normalizedName = String(forum.name || '').trim();
      const isTracked = Boolean(
        forum.isFollowing
        || forum.canManage
        || forum.isOwner
        || (currentUser?.id && forum.ownerId === currentUser.id)
        || isManagementLikeSpace(normalizedName)
      );
      if (!isTracked) {
        return;
      }
      const payload = {
        ...forum,
        isImportant: Boolean(forum.canManage || forum.isOwner || isManagementLikeSpace(normalizedName))
      };
      if (forum.id) {
        map.set(String(forum.id), payload);
      }
      if (forum.slug) {
        map.set(String(forum.slug), payload);
      }
      if (normalizedName) {
        map.set(normalizeText(normalizedName), payload);
      }
    });
    return map;
  }, [currentUser?.id, forums]);

  const userLookup = useMemo(() => {
    const map = new Map();
    [...followers, ...followingUsers].forEach((user) => {
      const userId = String(user?.id || '').trim();
      if (!userId) {
        return;
      }
      map.set(userId, {
        id: userId,
        name: user.name || 'User',
        avatarUrl: user.avatarUrl || '',
        bio: user.bio || ''
      });
    });
    return map;
  }, [followers, followingUsers]);

  const systemItems = useMemo(() => {
    const built = [];
    const seenPostIds = new Set();

    invites.forEach((invite) => {
      const invitePermissions = invite.permissions || [];
      const isAdminInvite = invitePermissions.includes('manage_admins');
      const category = isAdminInvite ? 'admin' : 'invitations';
      const forumSlug = String(invite.forumSlug || '').trim();
      built.push({
        id: `invite-${invite.id}`,
        category,
        actorType: 'space',
        actorName: invite.forumName,
        actorAvatarUrl: '',
        title: isAdminInvite
          ? `Admin invite: ${invite.forumName}`
          : `You were invited to manage ${invite.forumName}`,
        detail: invite.forumDescription || 'Review this invitation and choose whether to accept or decline.',
        meta: `Invited by ${invite.invitedByName || 'Unknown user'}`,
        timestamp: Number(invite.createdAt || 0),
        destination: forumSlug ? `/forum/${forumSlug}` : '/my-spaces',
        isInvitation: true,
        invitationId: invite.id,
        permissions: invitePermissions,
        isImportant: true
      });
    });

    followers.forEach((user) => {
      built.push({
        id: `social-follow-${user.id}`,
        category: 'social',
        actorType: 'user',
        actorName: user.name || 'User',
        actorAvatarUrl: user.avatarUrl || '',
        title: `${user.name || 'Someone'} followed you`,
        detail: user.bio || 'Visit their profile and follow back if relevant.',
        meta: `${formatCount(user.followerCount || 0)} followers`,
        timestamp: 0,
        destination: `/users/${user.id}`,
        isInvitation: false,
        isImportant: false
      });
    });

    followingPosts.forEach((post) => {
      if (!post?.id) {
        return;
      }
      seenPostIds.add(post.id);
      const forumName = String(post.forum?.name || '').trim();
      const forumId = String(post.forum?.id || '').trim();
      const forumSlug = String(post.forum?.slug || '').trim();
      const trackedSpace = trackedSpaceMap.get(forumId)
        || trackedSpaceMap.get(forumSlug)
        || trackedSpaceMap.get(normalizeText(forumName));
      const isImportant = Boolean(trackedSpace?.isImportant || isManagementLikeSpace(forumName));

      built.push({
        id: `activity-following-post-${post.id}`,
        category: isImportant ? 'admin' : 'activity',
        actorType: 'user',
        actorName: post.authorName || 'Creator',
        actorAvatarUrl: post.authorAvatarUrl || '',
        title: forumName
          ? `New post in ${forumName}`
          : `${post.authorName || 'A creator'} posted an update`,
        detail: post.title || getPostPreview(post.content) || 'Open post',
        meta: forumName ? `By ${post.authorName || 'Unknown user'}` : 'Creator update',
        timestamp: Number(post.updatedAt || post.createdAt || 0),
        destination: `/forum/post/${post.id}`,
        isInvitation: false,
        isImportant
      });
    });

    const fallbackSource = posts.length > 0 ? posts : recentPublicPosts;
    fallbackSource.forEach((post) => {
      if (!post?.id || seenPostIds.has(post.id)) {
        return;
      }
      if (String(post.authorId || '') === String(currentUser?.id || '')) {
        return;
      }
      const forumId = String(post.forum?.id || '').trim();
      const forumSlug = String(post.forum?.slug || '').trim();
      const forumName = String(post.forum?.name || '').trim();
      const trackedSpace = trackedSpaceMap.get(forumId)
        || trackedSpaceMap.get(forumSlug)
        || trackedSpaceMap.get(normalizeText(forumName));
      if (!trackedSpace && !isManagementLikeSpace(forumName)) {
        return;
      }
      const spaceName = trackedSpace?.name || forumName || 'followed space';
      const isImportant = Boolean(trackedSpace?.isImportant || isManagementLikeSpace(spaceName));
      built.push({
        id: `space-post-${post.id}`,
        category: isImportant ? 'admin' : 'spaces',
        actorType: 'space',
        actorName: spaceName,
        actorAvatarUrl: '',
        title: `New post in ${spaceName}`,
        detail: post.title || getPostPreview(post.content) || 'Open post',
        meta: `By ${post.authorName || 'Unknown user'}`,
        timestamp: Number(post.updatedAt || post.createdAt || 0),
        destination: `/forum/post/${post.id}`,
        isInvitation: false,
        isImportant
      });
    });

    if (currentUser?.hasAdminAccess || currentUser?.isAdmin) {
      built.push({
        id: 'system-admin-access',
        category: 'admin',
        actorType: 'system',
        actorName: 'System',
        actorAvatarUrl: '',
        title: 'Admin access is active',
        detail: 'Admin mode is available in your user menu when needed.',
        meta: 'System notice',
        timestamp: 0,
        destination: '/forum',
        isInvitation: false,
        isImportant: true
      });
    }

    return built
      .map((item) => ({ ...item, typeLabel: CATEGORY_LABELS[item.category] || 'Update' }))
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  }, [
    currentUser?.hasAdminAccess,
    currentUser?.id,
    currentUser?.isAdmin,
    followers,
    followingPosts,
    invites,
    posts,
    recentPublicPosts,
    trackedSpaceMap
  ]);

  const supportItems = useMemo(() => {
    const items = [];

    myPosts.forEach((post) => {
      const appealLog = Array.isArray(post?.moderation?.appealLog) ? post.moderation.appealLog : [];
      const appealRequestedAt = Number(post?.moderation?.appealRequestedAt || 0);
      const appealPath = `/my-posts/${post.id}/appeal`;
      if (appealLog.length > 0) {
        appealLog.forEach((entry) => {
          items.push({
            id: `support-appeal-${post.id}-${entry.id}`,
            category: 'appeal',
            actorRole: entry.authorRole || 'author',
            actorName: entry.authorRole === 'admin' ? 'Support' : 'You',
            title: `Appeal update on "${post.title}"`,
            detail: String(entry.message || '').trim() || 'Appeal note updated.',
            timestamp: Number(entry.createdAt || 0),
            destination: appealPath
          });
        });
      } else if (appealRequestedAt) {
        items.push({
          id: `support-appeal-${post.id}`,
          category: 'appeal',
          actorRole: 'author',
          actorName: 'You',
          title: `Appeal submitted for "${post.title}"`,
          detail: post.moderation?.appealNote || 'Your appeal is waiting for moderator review.',
          timestamp: appealRequestedAt,
          destination: appealPath
        });
      }
    });

    myForumRequests.forEach((request) => {
      const status = String(request.status || 'pending');
      const requestPath = request.status === 'rejected'
        ? `/forums/request/${request.id}/appeal`
        : '/forums/request/history';
      const timestamp = Number(request.reviewedAt || request.createdAt || 0);
      const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending';
      items.push({
        id: `support-space-request-${request.id}`,
        category: 'request',
        actorRole: 'admin',
        actorName: 'Support',
        title: `Space request "${request.name || request.slug}" · ${statusLabel}`,
        detail: request.reviewNote || (status === 'pending'
          ? 'Your request is still under review.'
          : 'Open the request workspace for details.'),
        timestamp,
        destination: requestPath
      });
    });

    return items.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  }, [myForumRequests, myPosts]);

  const supportItemsDesc = useMemo(
    () => [...supportItems].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)),
    [supportItems]
  );

  const mutualUserIdSet = useMemo(() => {
    const followingIds = new Set(followingUsers.map((user) => String(user?.id || '').trim()).filter(Boolean));
    const followerIds = new Set(followers.map((user) => String(user?.id || '').trim()).filter(Boolean));
    const mutual = new Set();
    followingIds.forEach((userId) => {
      if (followerIds.has(userId)) {
        mutual.add(userId);
      }
    });
    return mutual;
  }, [followers, followingUsers]);

  const requestRecords = useMemo(() => {
    const next = {};
    Object.entries(inboxState.requestByUserId || {}).forEach(([userId, rawRecord]) => {
      if (!rawRecord || typeof rawRecord !== 'object') {
        return;
      }
      next[userId] = {
        direction: rawRecord.direction === 'outbound' ? 'outbound' : 'inbound',
        status: ['pending', 'accepted', 'declined', 'ignored'].includes(rawRecord.status) ? rawRecord.status : 'pending',
        message: String(rawRecord.message || '').trim(),
        createdAt: Number(rawRecord.createdAt || 0),
        updatedAt: Number(rawRecord.updatedAt || 0),
        name: String(rawRecord.name || '').trim(),
        avatarUrl: String(rawRecord.avatarUrl || '').trim()
      };
    });
    return next;
  }, [inboxState.requestByUserId]);

  const requestThreads = useMemo(() => {
    const built = [];

    followers.forEach((follower) => {
      const userId = String(follower?.id || '').trim();
      if (!userId || userId === String(currentUser?.id || '')) {
        return;
      }
      if (mutualUserIdSet.has(userId)) {
        return;
      }
      const existing = requestRecords[userId];
      const status = existing?.status || 'pending';
      if (status === 'accepted') {
        return;
      }
      if ((status === 'declined' || status === 'ignored') && existing?.direction !== 'outbound') {
        return;
      }
      built.push({
        id: `thread-request-${userId}`,
        kind: 'request',
        threadType: 'requests',
        userId,
        title: existing?.name || follower.name || 'User',
        avatarUrl: existing?.avatarUrl || follower.avatarUrl || '',
        preview: existing?.message || `Message request from ${follower.name || 'this user'}.`,
        latestAt: Number(existing?.updatedAt || existing?.createdAt || 0),
        unreadCount: status === 'pending' ? 1 : 0,
        direction: existing?.direction || 'inbound',
        status,
        message: existing?.message || `Hi, I'd like to connect here on tsumit.`,
        createdAt: Number(existing?.createdAt || Date.now())
      });
    });

    Object.entries(requestRecords).forEach(([userId, record]) => {
      if (!userId || built.some((thread) => thread.userId === userId)) {
        return;
      }
      if (record.status === 'accepted') {
        return;
      }
      const userMeta = userLookup.get(userId);
      built.push({
        id: `thread-request-${userId}`,
        kind: 'request',
        threadType: 'requests',
        userId,
        title: record.name || userMeta?.name || 'User',
        avatarUrl: record.avatarUrl || userMeta?.avatarUrl || '',
        preview: record.message || (record.direction === 'outbound' ? 'Awaiting response...' : 'Message request'),
        latestAt: Number(record.updatedAt || record.createdAt || 0),
        unreadCount: record.status === 'pending' && record.direction === 'inbound' ? 1 : 0,
        direction: record.direction,
        status: record.status,
        message: record.message || '',
        createdAt: Number(record.createdAt || Date.now())
      });
    });

    return built.sort((a, b) => Number(b.latestAt || 0) - Number(a.latestAt || 0));
  }, [currentUser?.id, followers, mutualUserIdSet, requestRecords, userLookup]);

  const directThreads = useMemo(() => {
    const directByUserId = inboxState.directByUserId || {};
    const participantIds = new Set();

    mutualUserIdSet.forEach((userId) => participantIds.add(userId));
    Object.keys(directByUserId).forEach((userId) => participantIds.add(String(userId)));
    Object.entries(requestRecords).forEach(([userId, record]) => {
      if (record.status === 'accepted') {
        participantIds.add(String(userId));
      }
    });

    const built = [];
    participantIds.forEach((userId) => {
      const userMeta = userLookup.get(userId);
      const requestMeta = requestRecords[userId];
      const messages = safeMessageList(directByUserId[userId]);
      const lastMessage = messages[messages.length - 1] || null;
      const fallbackTimestamp = Number(requestMeta?.updatedAt || requestMeta?.createdAt || 0);
      const latestAt = Number(lastMessage?.timestamp || fallbackTimestamp || 0);
      const readAt = Number(inboxState.readAtByThread?.[`thread-dm-${userId}`] || 0);
      const unreadCount = messages.filter((entry) => Number(entry.timestamp || 0) > readAt && entry.senderId !== String(currentUser?.id || '')).length;

      built.push({
        id: `thread-dm-${userId}`,
        kind: 'direct',
        threadType: 'direct',
        userId,
        title: userMeta?.name || requestMeta?.name || 'User',
        avatarUrl: userMeta?.avatarUrl || requestMeta?.avatarUrl || '',
        preview: lastMessage?.content || (requestMeta?.status === 'accepted' ? 'Conversation open' : 'Start your conversation'),
        latestAt,
        unreadCount,
        messages
      });
    });

    return built
      .filter((thread) => thread.messages.length > 0 || thread.latestAt > 0 || mutualUserIdSet.has(thread.userId))
      .sort((a, b) => Number(b.latestAt || 0) - Number(a.latestAt || 0));
  }, [currentUser?.id, inboxState.directByUserId, inboxState.readAtByThread, mutualUserIdSet, requestRecords, userLookup]);

  const filteredSystemItems = useMemo(
    () => systemItems.filter((item) => systemFilter === 'all' || item.category === systemFilter),
    [systemFilter, systemItems]
  );

  const selectedSystemItem = useMemo(
    () => filteredSystemItems.find((item) => item.id === selectedSystemItemId) || filteredSystemItems[0] || null,
    [filteredSystemItems, selectedSystemItemId]
  );

  const systemThread = useMemo(() => {
    const latestAt = Number(systemItems[0]?.timestamp || 0);
    const readAt = Number(inboxState.readAtByThread?.['thread-system'] || 0);
    const unreadCount = systemItems.filter((item) => Number(item.timestamp || 0) > readAt).length;
    return {
      id: 'thread-system',
      kind: 'system',
      threadType: 'system',
      title: 'System',
      preview: systemItems[0]?.title || 'Platform updates and activity',
      latestAt,
      unreadCount
    };
  }, [inboxState.readAtByThread, systemItems]);

  const filteredRequestThreads = useMemo(() => {
    const query = normalizeText(threadQuery);
    return requestThreads.filter((thread) => {
      if (!query) {
        return true;
      }
      return [thread.title, thread.preview, thread.message].some((value) => normalizeText(value).includes(query));
    });
  }, [requestThreads, threadQuery]);

  const filteredDirectThreads = useMemo(() => {
    const query = normalizeText(threadQuery);
    return directThreads.filter((thread) => {
      if (!query) {
        return true;
      }
      return [thread.title, thread.preview].some((value) => normalizeText(value).includes(query));
    });
  }, [directThreads, threadQuery]);

  const visibleConversationThreads = useMemo(() => {
    if (activeSection === 'requests') {
      return filteredRequestThreads;
    }
    if (activeSection === 'direct') {
      return filteredDirectThreads;
    }
    return [];
  }, [activeSection, filteredDirectThreads, filteredRequestThreads]);

  const selectedThread = useMemo(() => {
    if (activeSection === 'system') {
      return systemThread;
    }
    return visibleConversationThreads.find((thread) => thread.id === selectedThreadId) || visibleConversationThreads[0] || null;
  }, [activeSection, selectedThreadId, systemThread, visibleConversationThreads]);

  const selectedThreadReadMeta = useMemo(() => ({
    id: String(selectedThread?.id || '').trim(),
    timestamp: Number(selectedThread?.latestAt || 0)
  }), [selectedThread?.id, selectedThread?.latestAt]);

  useEffect(() => {
    if (!selectedThreadReadMeta.id || !selectedThreadReadMeta.timestamp) {
      return;
    }
    setInboxState((current) => markThreadAsRead(current, selectedThreadReadMeta.id, selectedThreadReadMeta.timestamp));
  }, [selectedThreadReadMeta.id, selectedThreadReadMeta.timestamp]);

  useEffect(() => {
    if (activeSection === 'system') {
      if (!selectedSystemItem && filteredSystemItems.length > 0) {
        setSelectedSystemItemId(filteredSystemItems[0].id);
      }
      return;
    }
    if (!selectedThread && visibleConversationThreads.length > 0) {
      setSelectedThreadId(visibleConversationThreads[0].id);
    }
  }, [
    activeSection,
    filteredSystemItems,
    selectedSystemItem,
    selectedThread,
    visibleConversationThreads
  ]);

  const requestUnreadCount = useMemo(
    () => requestThreads.reduce((sum, thread) => sum + Number(thread.unreadCount || 0), 0),
    [requestThreads]
  );

  const directUnreadCount = useMemo(
    () => directThreads.reduce((sum, thread) => sum + Number(thread.unreadCount || 0), 0),
    [directThreads]
  );

  const inboxSections = useMemo(() => {
    const unreadMap = {
      system: Number(systemThread.unreadCount || 0),
      requests: requestUnreadCount,
      direct: directUnreadCount
    };

    return INBOX_SECTION_OPTIONS.map((item) => ({
      ...item,
      unreadCount: unreadMap[item.value] || 0
    }));
  }, [directUnreadCount, requestUnreadCount, systemThread.unreadCount]);

  const totalUnread = useMemo(
    () => (
      Number(systemThread.unreadCount || 0)
      + requestUnreadCount
      + directUnreadCount
    ),
    [directUnreadCount, requestUnreadCount, systemThread.unreadCount]
  );

  const systemReadAt = Number(inboxState.readAtByThread?.['thread-system'] || 0);

  const handleAcceptInvite = async (notification) => {
    if (!notification?.invitationId) {
      return;
    }
    const inviteId = notification.invitationId;
    setActionKey(`accept-${inviteId}`);
    setMessage('');
    setError('');
    try {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }
      const response = await apiAcceptForumManagerInvite(inviteId, token);
      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      await onLoadForums?.();
      setMessage(response.message || 'Invitation accepted.');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Failed to accept invitation.');
    } finally {
      setActionKey('');
    }
  };

  const handleRejectInvite = async (notification) => {
    if (!notification?.invitationId) {
      return;
    }
    const inviteId = notification.invitationId;
    setActionKey(`reject-${inviteId}`);
    setMessage('');
    setError('');
    try {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }
      const response = await apiRejectForumManagerInvite(inviteId, token);
      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      setMessage(response.message || 'Invitation declined.');
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Failed to decline invitation.');
    } finally {
      setActionKey('');
    }
  };

  const updateRequestStatus = useCallback((thread, status) => {
    const userId = typeof thread === 'string'
      ? String(thread || '').trim()
      : String(thread?.userId || '').trim();
    if (!userId) {
      return;
    }
    setInboxState((current) => {
      const existing = current.requestByUserId?.[userId];
      const fallbackRecord = typeof thread === 'object' && thread
        ? {
          direction: thread.direction || 'inbound',
          status: 'pending',
          message: thread.message || '',
          createdAt: Number(thread.createdAt || Date.now()),
          updatedAt: Number(thread.latestAt || thread.createdAt || Date.now()),
          name: thread.title || '',
          avatarUrl: thread.avatarUrl || ''
        }
        : null;
      const base = existing || fallbackRecord;
      if (!base) {
        return current;
      }
      return {
        ...current,
        requestByUserId: {
          ...current.requestByUserId,
          [userId]: {
            ...base,
            status,
            updatedAt: Date.now()
          }
        }
      };
    });
  }, []);

  const acceptRequestThread = useCallback((thread) => {
    const userId = String(thread?.userId || '').trim();
    if (!userId) {
      return;
    }
    setInboxState((current) => {
      const existingRequest = current.requestByUserId?.[userId] || {
        direction: thread.direction || 'inbound',
        status: 'pending',
        message: thread.message || '',
        createdAt: Number(thread.createdAt || Date.now()),
        updatedAt: Number(thread.latestAt || thread.createdAt || Date.now()),
        name: thread.title || '',
        avatarUrl: thread.avatarUrl || ''
      };
      const currentMessages = safeMessageList(current.directByUserId?.[userId]);
      const nextMessages = currentMessages.length > 0
        ? currentMessages
        : [{
          id: createId('dm'),
          senderId: existingRequest.direction === 'inbound' ? userId : String(currentUser?.id || ''),
          content: existingRequest.message || 'Connection request accepted.',
          timestamp: Number(existingRequest.createdAt || Date.now())
        }];

      return {
        ...current,
        requestByUserId: {
          ...current.requestByUserId,
          [userId]: {
            ...existingRequest,
            status: 'accepted',
            updatedAt: Date.now()
          }
        },
        directByUserId: {
          ...current.directByUserId,
          [userId]: nextMessages
        }
      };
    });
    setSelectedThreadId(`thread-dm-${userId}`);
  }, [currentUser?.id]);

  const sendDirectMessage = useCallback((thread) => {
    const userId = String(thread?.userId || '').trim();
    const content = String(directDraft || '').trim();
    if (!userId || !content) {
      return;
    }
    setInboxState((current) => {
      const currentMessages = safeMessageList(current.directByUserId?.[userId]);
      const nextMessages = [...currentMessages, {
        id: createId('dm'),
        senderId: String(currentUser?.id || ''),
        content,
        timestamp: Date.now()
      }];
      return {
        ...current,
        directByUserId: {
          ...current.directByUserId,
          [userId]: nextMessages
        }
      };
    });
    setDirectDraft('');
  }, [currentUser?.id, directDraft]);

  const createOutboundRequest = useCallback(() => {
    const targetId = String(requestTarget?.id || '').trim();
    const content = String(requestDraft || '').trim();
    if (!targetId || !content) {
      return;
    }
    if (targetId === String(currentUser?.id || '')) {
      setError('You cannot send a request to yourself.');
      return;
    }
    const existingRequest = requestRecords[targetId];
    if (existingRequest && existingRequest.status === 'pending') {
      setError('You already have a pending request with this user.');
      return;
    }
    setInboxState((current) => {
      const existing = current.requestByUserId?.[targetId];
      if (existing && existing.status === 'pending') {
        return current;
      }
      return {
        ...current,
        requestByUserId: {
          ...current.requestByUserId,
          [targetId]: {
            direction: 'outbound',
            status: 'pending',
            message: content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            name: requestTarget.name || 'User',
            avatarUrl: requestTarget.avatarUrl || ''
          }
        }
      };
    });
    setMessage(`Message request sent to ${requestTarget.name || 'user'}.`);
    setError('');
    setRequestComposerOpen(false);
    setRequestTargetQuery('');
    setRequestTargetResults([]);
    setRequestTarget(null);
    setRequestDraft('');
    setSelectedThreadId(`thread-request-${targetId}`);
  }, [currentUser?.id, requestDraft, requestRecords, requestTarget]);

  return (
    <div className="container page-shell">
      <section className="inbox-page-shell">
        <header className="inbox-header">
          <div>
            <h1 className="community-feed-title mb-1">Inbox</h1>
            <p className="my-posts-subtext mb-0">System updates and messages in one place.</p>
          </div>
          <span className="community-feed-count">{totalUnread} unread</span>
        </header>

        {error ? <div className="settings-alert is-error mb-0">{error}</div> : null}
        {message ? <div className="settings-alert is-success mb-0">{message}</div> : null}

        {loading ? (
          <section className="settings-card">
            <p className="muted mb-0">Loading inbox...</p>
          </section>
        ) : (
          <section className="inbox-layout">
            <aside className="inbox-thread-list-panel" aria-label="Inbox sections">
              <div className="inbox-thread-list-head">
                <h2 className="inbox-panel-title mb-0">Inbox</h2>
                <button
                  type="button"
                  className="forum-secondary-btn"
                  onClick={() => setRequestComposerOpen((open) => !open)}
                >
                  {requestComposerOpen ? 'Close request' : 'New request'}
                </button>
              </div>

              <nav className="inbox-nav-list" aria-label="Inbox sections">
                {inboxSections.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`inbox-nav-item ${activeSection === item.value ? 'is-active' : ''}`.trim()}
                    onClick={() => setActiveSection(item.value)}
                  >
                    <span className="inbox-nav-item-copy">
                      <span className="inbox-nav-item-title">{item.label}</span>
                      <span className="inbox-nav-item-hint">{item.hint}</span>
                    </span>
                    {item.unreadCount > 0 ? <span className="inbox-thread-unread">{item.unreadCount}</span> : null}
                  </button>
                ))}
              </nav>

              {requestComposerOpen ? (
                <section className="inbox-request-composer">
                  <label className="community-feed-control mb-0">
                    <span className="community-feed-control-label">Find user</span>
                    <div className="community-feed-search">
                      <input
                        className="form-control forum-input tag-search-input"
                        value={requestTargetQuery}
                        onChange={(event) => {
                          setRequestTargetQuery(event.target.value);
                          setRequestTarget(null);
                        }}
                        placeholder="Search user by name"
                      />
                    </div>
                  </label>

                  {requestSearching ? <p className="muted mb-0">Searching users...</p> : null}

                  {requestTargetResults.length > 0 ? (
                    <div className="inbox-request-target-list">
                      {requestTargetResults.map((user) => (
                        <button
                          key={`target-${user.id}`}
                          type="button"
                          className={`inbox-request-target ${requestTarget?.id === user.id ? 'is-active' : ''}`.trim()}
                          onClick={() => setRequestTarget(user)}
                        >
                          <Avatar imageUrl={user.avatarUrl} name={user.name} size={28} />
                          <span>{user.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <label className="community-feed-control mb-0">
                    <span className="community-feed-control-label">Initial message request</span>
                    <textarea
                      className="form-control forum-input inbox-request-textarea"
                      value={requestDraft}
                      onChange={(event) => setRequestDraft(event.target.value)}
                      placeholder="Send one initial message request."
                      rows={3}
                    />
                  </label>

                  <button
                    type="button"
                    className="forum-primary-btn"
                    onClick={createOutboundRequest}
                    disabled={!requestTarget || !String(requestDraft || '').trim()}
                  >
                    Send request
                  </button>
                </section>
              ) : null}

              {activeSection === 'system' ? (
                <>
                  <section className="inbox-thread-controls" aria-label="System update controls">
                    <nav className="notifications-segmented" aria-label="System updates filter">
                      {SYSTEM_FILTER_OPTIONS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`notifications-segment-btn ${systemFilter === item.value ? 'is-active' : ''}`.trim()}
                          onClick={() => setSystemFilter(item.value)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  </section>

                  <div className="inbox-conversation-list-head">
                    <h3 className="inbox-list-title mb-0">System Updates</h3>
                    <span className="muted">{filteredSystemItems.length}</span>
                  </div>

                  <section className="inbox-thread-list">
                    {filteredSystemItems.length === 0 ? (
                      <p className="muted mb-0">No system updates in this category.</p>
                    ) : (
                      filteredSystemItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`inbox-thread-item ${selectedSystemItem?.id === item.id ? 'is-active' : ''}`.trim()}
                          onClick={() => setSelectedSystemItemId(item.id)}
                        >
                          <NotificationActor notification={item} />
                          <span className="inbox-thread-copy">
                            <span className="inbox-thread-top">
                              <strong>{item.title}</strong>
                              <span>{formatTimestamp(item.timestamp)}</span>
                            </span>
                            <span className="inbox-thread-preview">{item.detail}</span>
                          </span>
                          {Number(item.timestamp || 0) > systemReadAt ? <span className="inbox-thread-unread">1</span> : null}
                        </button>
                      ))
                    )}
                  </section>
                </>
              ) : (
                <>
                  <section className="community-feed-control-bar inbox-thread-controls" aria-label="Conversation controls">
                    <label className="community-feed-control community-feed-control-search">
                      <span className="community-feed-control-label">Refine results</span>
                      <div className="community-feed-search">
                        <input
                          className="form-control forum-input tag-search-input"
                          value={threadQuery}
                          onChange={(event) => setThreadQuery(event.target.value)}
                          placeholder={activeSection === 'requests' ? 'Filter requests' : 'Filter messages'}
                        />
                        {threadQuery ? (
                          <button
                            type="button"
                            className="community-feed-search-clear"
                            onClick={() => setThreadQuery('')}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </label>
                  </section>

                  <div className="inbox-conversation-list-head">
                    <h3 className="inbox-list-title mb-0">{activeSection === 'requests' ? 'Requests' : 'Messages'}</h3>
                    <span className="muted">{visibleConversationThreads.length}</span>
                  </div>

                  <section className="inbox-thread-list">
                    {visibleConversationThreads.length === 0 ? (
                      <p className="muted mb-0">
                        {activeSection === 'requests' ? 'No message requests in this view.' : 'No direct messages yet.'}
                      </p>
                    ) : (
                      visibleConversationThreads.map((thread) => (
                        <button
                          key={thread.id}
                          type="button"
                          className={`inbox-thread-item ${selectedThread?.id === thread.id ? 'is-active' : ''}`.trim()}
                          onClick={() => setSelectedThreadId(thread.id)}
                        >
                          <ThreadAvatar thread={thread} />
                          <span className="inbox-thread-copy">
                            <span className="inbox-thread-top">
                              <strong>{thread.title}</strong>
                              <span>{formatTimestamp(thread.latestAt)}</span>
                            </span>
                            <span className="inbox-thread-preview">{thread.preview || 'No updates yet.'}</span>
                          </span>
                          {thread.unreadCount > 0 ? <span className="inbox-thread-unread">{thread.unreadCount}</span> : null}
                        </button>
                      ))
                    )}
                  </section>
                </>
              )}
            </aside>

            <section className="inbox-conversation-panel" aria-label="Inbox detail">
              {activeSection === 'system' ? (
                <div className="inbox-conversation-shell">
                  <div className="inbox-conversation-head">
                    <div>
                      <h2 className="inbox-panel-title mb-1">System Updates</h2>
                      <p className="muted mb-0">Select an update on the left to view full details.</p>
                    </div>
                    <button
                      type="button"
                      className="forum-secondary-btn"
                      onClick={() => {
                        setInboxState((current) => markThreadAsRead(current, 'thread-system', Date.now()));
                      }}
                    >
                      Mark all read
                    </button>
                  </div>

                  {!selectedSystemItem ? (
                    <div className="notifications-empty-state">
                      <h3 className="my-posts-empty-title mb-0">You&apos;re all caught up</h3>
                      <p className="my-posts-empty-copy mb-0">No system updates in this category.</p>
                    </div>
                  ) : (
                    <article
                      className={`notification-item ${selectedSystemItem.isImportant ? 'is-important' : ''}`.trim()}
                    >
                      <div className="notification-item-main">
                        <NotificationActor notification={selectedSystemItem} />
                        <div className="notification-item-copy">
                          <div className="notification-item-title-row">
                            <p className="notification-item-title mb-0">{selectedSystemItem.title}</p>
                            <span className={`notification-item-type is-${selectedSystemItem.category}`.trim()}>
                              {selectedSystemItem.typeLabel}
                            </span>
                          </div>
                          <p className="notification-item-detail mb-0">{selectedSystemItem.detail}</p>
                          <p className="notification-item-meta mb-0">
                            <span>{selectedSystemItem.meta}</span>
                            <span>{formatTimestamp(selectedSystemItem.timestamp)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="notification-item-actions">
                        {selectedSystemItem.destination ? (
                          <Link to={selectedSystemItem.destination} className="forum-secondary-btn text-decoration-none">
                            Open
                          </Link>
                        ) : null}

                        {selectedSystemItem.isInvitation ? (
                          <>
                            <button
                              type="button"
                              className="forum-primary-btn"
                              onClick={() => handleAcceptInvite(selectedSystemItem)}
                              disabled={actionKey === `accept-${selectedSystemItem.invitationId}` || actionKey === `reject-${selectedSystemItem.invitationId}`}
                            >
                              {actionKey === `accept-${selectedSystemItem.invitationId}` ? 'Accepting...' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              className="forum-secondary-btn"
                              onClick={() => handleRejectInvite(selectedSystemItem)}
                              disabled={actionKey === `accept-${selectedSystemItem.invitationId}` || actionKey === `reject-${selectedSystemItem.invitationId}`}
                            >
                              {actionKey === `reject-${selectedSystemItem.invitationId}` ? 'Declining...' : 'Decline'}
                            </button>
                          </>
                        ) : null}
                      </div>

                      {selectedSystemItem.isInvitation && (selectedSystemItem.permissions || []).length > 0 ? (
                        <div className="notification-item-permissions">
                          {(selectedSystemItem.permissions || []).map((permission) => (
                            <span key={`${selectedSystemItem.id}-${permission}`} className="section-chip is-active">
                              {FORUM_PERMISSION_LABELS[permission] || permission}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  )}
                </div>
              ) : !selectedThread ? (
                <div className="inbox-conversation-shell">
                  <div className="notifications-empty-state">
                    <h3 className="my-posts-empty-title mb-0">
                      {activeSection === 'requests' ? 'No requests selected' : 'No messages selected'}
                    </h3>
                    <p className="my-posts-empty-copy mb-0">
                      {activeSection === 'requests'
                        ? 'Select a request from the left list to review it.'
                        : 'Select a conversation from the left list to open it.'}
                    </p>
                  </div>
                </div>
              ) : selectedThread.kind === 'request' ? (
                <div className="inbox-conversation-shell">
                  <div className="inbox-conversation-head">
                    <div className="inbox-request-user-head">
                      <Avatar imageUrl={selectedThread.avatarUrl} name={selectedThread.title} size={40} />
                      <div>
                        <h2 className="inbox-panel-title mb-1">{selectedThread.title}</h2>
                        <p className="muted mb-0">
                          {selectedThread.direction === 'inbound' ? 'Incoming message request' : 'Outgoing message request'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <article className="inbox-request-card">
                    <p className="inbox-request-message mb-0">{selectedThread.message}</p>
                    <p className="inbox-request-meta mb-0">{formatTimestamp(selectedThread.createdAt)}</p>
                    {selectedThread.status === 'pending' && selectedThread.direction === 'inbound' ? (
                      <div className="inbox-request-actions">
                        <button type="button" className="forum-primary-btn" onClick={() => acceptRequestThread(selectedThread)}>
                          Accept
                        </button>
                        <button type="button" className="forum-secondary-btn" onClick={() => updateRequestStatus(selectedThread, 'declined')}>
                          Decline
                        </button>
                        <button type="button" className="forum-secondary-btn" onClick={() => updateRequestStatus(selectedThread, 'ignored')}>
                          Ignore
                        </button>
                      </div>
                    ) : null}
                    {selectedThread.status === 'pending' && selectedThread.direction === 'outbound' ? (
                      <div className="inbox-request-actions">
                        <span className="muted">Waiting for response. You can only send one initial request before acceptance.</span>
                      </div>
                    ) : null}
                  </article>
                </div>
              ) : (
                <div className="inbox-conversation-shell">
                  <div className="inbox-conversation-head">
                    <div className="inbox-request-user-head">
                      <Avatar imageUrl={selectedThread.avatarUrl} name={selectedThread.title} size={40} />
                      <div>
                        <h2 className="inbox-panel-title mb-1">{selectedThread.title}</h2>
                        <p className="muted mb-0">Direct messages</p>
                      </div>
                    </div>
                  </div>

                  <section className="inbox-direct-messages">
                    {selectedThread.messages.length === 0 ? (
                      <p className="muted mb-0">No messages yet.</p>
                    ) : (
                      selectedThread.messages.map((entry) => {
                        const isOwn = String(entry.senderId) === String(currentUser?.id || '');
                        return (
                          <article key={entry.id} className={`inbox-direct-message ${isOwn ? 'is-own' : ''}`.trim()}>
                            <div className="inbox-direct-message-bubble">
                              <p className="mb-0">{entry.content}</p>
                            </div>
                            <span className="inbox-direct-message-time">{formatTimestamp(entry.timestamp)}</span>
                          </article>
                        );
                      })
                    )}
                  </section>

                  <form
                    className="inbox-direct-composer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendDirectMessage(selectedThread);
                    }}
                  >
                    <textarea
                      className="form-control forum-input"
                      value={directDraft}
                      onChange={(event) => setDirectDraft(event.target.value)}
                      rows={2}
                      placeholder="Write a message..."
                    />
                    <button type="submit" className="forum-primary-btn" disabled={!String(directDraft || '').trim()}>
                      Send
                    </button>
                  </form>
                </div>
              )}

              <section className="inbox-support-shortcuts">
                <div className="inbox-support-shortcuts-head">
                  <h3 className="inbox-list-title mb-0">Support & Appeals</h3>
                  <span className="muted">{supportItemsDesc.length}</span>
                </div>
                <p className="muted mb-0">Appeals and request reviews open in dedicated pages.</p>
                <div className="inbox-conversation-links">
                  <Link to="/my-posts" className="forum-secondary-btn text-decoration-none">My Posts</Link>
                  <Link to="/forums/request/history" className="forum-secondary-btn text-decoration-none">Request History</Link>
                </div>
              </section>
            </section>
          </section>
        )}
      </section>
    </div>
  );
}
