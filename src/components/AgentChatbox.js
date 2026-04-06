import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSectionLabel } from '../lib/sections';

export default function AgentChatbox({ currentUser, onAgentChat, onCreatePost }) {
  const navigate = useNavigate();
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const basePrompts = [
    'take me to the about page so i can understand what this community is for',
    'show me the latest announcements and summarize what changed most recently',
    'show me the newest posts so i can catch up on recent discussion',
    'i want to learn mle, show me a few useful posts to start with',
    'find posts about analytics dashboards, experiments, or product metrics',
    'show top authors who post often and seem active in technical discussions',
    'draft a space request for an mlops community with a clear name, description, and section scope'
  ];
  const starterPrompts = currentUser
    ? [
        ...basePrompts,
        'i want to change my password and go to the right settings page',
        'take me to my posts so i can review what i have already published',
        'draft a post in my style about postgres indexing that feels ready to publish'
      ]
    : [
        ...basePrompts,
        'find posts about mongodb performance, indexing, or query tuning',
        'draft a post about password reset best practices for users and admins'
      ];
  const buildWelcomeMessage = useCallback(() => ({
    id: 'welcome',
    role: 'agent',
    reply: currentUser
      ? 'Ask me to navigate the site, show the latest posts or announcements, find posts for a topic, surface active authors, draft a post in your style, or draft a new space request.'
      : 'Ask me to navigate the site, show the latest posts or announcements, find posts for a topic, surface active authors, draft a post, or draft a new space request.',
    quickActions: ['search-posts', 'show-trending', 'draft-post']
  }), [currentUser]);
  const [messages, setMessages] = useState([buildWelcomeMessage()]);
  const [loading, setLoading] = useState(false);

  const scrollThreadToBottom = useCallback(() => {
    if (!threadRef.current) {
      return;
    }

    const thread = threadRef.current;
    window.requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });
  }, []);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.id !== 'welcome') {
        return current;
      }
      return [buildWelcomeMessage()];
    });
  }, [buildWelcomeMessage]);

  useEffect(() => {
    if (!isOpen || !threadRef.current) {
      return;
    }
    scrollThreadToBottom();
  }, [isOpen, messages, loading, scrollThreadToBottom]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  const fillInputFromPrompt = (prompt) => {
    setInput(String(prompt || ''));
    setEditingMessageId(null);
    inputRef.current?.focus();
    scrollThreadToBottom();
  };

  const startEditingMessage = (message) => {
    if (!message?.id || message.role !== 'user' || loading) {
      return;
    }

    setEditingMessageId(message.id);
    setInput(String(message.text || ''));
    inputRef.current?.focus();
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setInput('');
  };

  const stopThinking = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
  };

  const clearConversation = () => {
    if (loading) {
      stopThinking();
    }
    setMessages([buildWelcomeMessage()]);
    setInput('');
    setEditingMessageId(null);
    setShowPrompts(false);
    scrollThreadToBottom();
  };

  const sendMessage = async (nextMessage) => {
    const message = String(nextMessage || input).trim();
    if (!message || loading) {
      return;
    }

    const targetMessageId = editingMessageId;
    const nextUserMessage = { id: targetMessageId || `${Date.now()}-user`, role: 'user', text: message };

    setMessages((current) => {
      if (!targetMessageId) {
        return [...current, nextUserMessage];
      }

      const targetIndex = current.findIndex((entry) => entry.id === targetMessageId);
      if (targetIndex === -1) {
        return [...current, nextUserMessage];
      }

      return [
        ...current.slice(0, targetIndex),
        nextUserMessage
      ];
    });

    setInput('');
    setEditingMessageId(null);
    setShowPrompts(false);
    setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const result = await onAgentChat(message, controller.signal);
      abortControllerRef.current = null;
      setLoading(false);

      if (!result.ok) {
        if (result.message === 'Request cancelled.') {
          return;
        }
        setMessages((current) => [
          ...current,
          { id: `${Date.now()}-error`, role: 'agent', reply: result.message || 'Agent request failed.' }
        ]);
        return;
      }

      if (result.data?.navigateTo && result.data?.autoNavigate) {
        navigate(result.data.navigateTo);
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-agent`,
          role: 'agent',
          ...result.data
        }
      ]);
    } catch (error) {
      abortControllerRef.current = null;
      setLoading(false);
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-error`, role: 'agent', reply: error?.message || 'Agent request failed.' }
      ]);
    }
  };

  const publishDraft = async (draft) => {
    const result = await onCreatePost(draft);
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-publish`,
        role: 'agent',
        reply: result.ok
          ? 'Draft published. I refreshed the latest feed state, and you can open it from My Posts or the feed.'
          : result.message
      }
    ]);
    if (result.ok) {
      navigate('/forum');
    }
  };

  const openDraftInComposerForForum = (draft, forumOption) => {
    if (!draft || !forumOption?.id) {
      return;
    }

    openDraftInComposer({
      ...draft,
      forumId: forumOption.id,
      section: forumOption.suggestedSection || draft.section
    });
  };

  const openDraftInComposer = (draft) => {
    if (!draft) {
      return;
    }

    navigate('/forum?compose=1', {
      state: {
        composerDraft: {
          title: draft.title,
          content: draft.content,
          forumId: draft.forumId,
          section: draft.section,
          tags: draft.tags || []
        }
      }
    });
  };

  const openForumRequestDraft = (forumRequestDraft) => {
    if (!forumRequestDraft) {
      return;
    }

    navigate('/forums/request', {
      state: {
        forumRequestDraft: {
          name: forumRequestDraft.name,
          overview: forumRequestDraft.overview,
          description: forumRequestDraft.description,
          rationale: forumRequestDraft.rationale,
          sectionScope: forumRequestDraft.sectionScope || []
        }
      }
    });
  };

  return (
    <div className={`agent-chatbox ${isOpen ? 'is-open' : ''}`}>
      {isOpen && (
        <section className="agent-chatbox-panel">
          <div className="agent-chatbox-header">
            <div className="agent-chatbox-header-main">
              <div className="agent-chatbox-eyebrow-row">
                <span className="agent-chatbox-eyebrow">AI Agent</span>
                <span className="agent-chatbox-status-pill">
                  <span className="agent-chatbox-status-dot" aria-hidden="true" />
                  Ready
                </span>
              </div>
                <h3 className="mb-0">tsumit Assistant</h3>
              <p className="agent-chatbox-subtitle mb-0">
                Open pages, check recent posts or announcements, search topics, and draft content from one place.
              </p>
            </div>
            <div className="agent-chatbox-header-actions">
              <button type="button" className="forum-secondary-btn" onClick={clearConversation}>
                Clear chat
              </button>
              <button type="button" className="forum-secondary-btn" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <div className="agent-chatbox-prompts-shell">
            <button
              type="button"
              className="agent-chatbox-prompts-toggle"
              onClick={() => setShowPrompts((current) => !current)}
            >
              {showPrompts ? 'Hide examples' : 'Show examples'}
            </button>
            <span className="agent-chatbox-prompts-hint">Use a prompt or type your own task.</span>
          </div>

          <div className={`agent-chatbox-prompts ${showPrompts ? 'is-expanded' : ''}`}>
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="agent-chatbox-prompt-chip"
                onClick={() => fillInputFromPrompt(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div ref={threadRef} className="agent-chatbox-thread">
            {messages.map((message) => (
              <div key={message.id} className={`agent-chatbox-message is-${message.role}`}>
                {message.role === 'user' ? (
                  <>
                    <div className="agent-chatbox-message-label">You</div>
                    <div className="agent-chatbox-user-message-row">
                      <p className="mb-0">{message.text}</p>
                      <button
                        type="button"
                        className="agent-chatbox-inline-action"
                        onClick={() => startEditingMessage(message)}
                        disabled={loading}
                      >
                        Edit
                      </button>
                    </div>
                    {editingMessageId === message.id && (
                      <span className="agent-chatbox-editing-note">Editing this message. Resend to replace the replies below it.</span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="agent-chatbox-message-label">Assistant</div>
                    <p className="mb-2">{message.reply}</p>

                    {message.posts?.length > 0 && (
                      <div className="agent-chatbox-card-grid">
                        {message.posts.map((post) => (
                          <Link key={post.id} to={`/forum/post/${post.id}`} className="agent-chatbox-card">
                            <strong>{post.title}</strong>
                            <span>{post.authorName}</span>
                            <span>{getSectionLabel(post.section)}</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {message.authors?.length > 0 && (
                      <div className="agent-chatbox-card-grid">
                        {message.authors.map((author) => (
                          <div key={`${author.author_email}-${author.rank || author.author_name}`} className="agent-chatbox-card">
                            <strong>{author.author_name}</strong>
                            <span>{author.post_count} posts</span>
                            {author.score !== undefined && <span>score {author.score}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {message.styleProfile && (
                      <div className="agent-chatbox-profile">
                        <strong>Your Writing Profile</strong>
                        <p className="mb-2">{message.styleProfile.summary}</p>
                        <div className="agent-chatbox-meta-row">
                          <span>{message.styleProfile.sampleSize} posts sampled</span>
                          <span>~{message.styleProfile.avgWordCount} words/post</span>
                          <span>{message.styleProfile.openerStyle} opener</span>
                        </div>
                        {message.styleProfile.tone?.length > 0 && (
                          <div className="agent-chatbox-pill-row">
                            {message.styleProfile.tone.map((tone) => (
                              <span key={`tone-${tone}`} className="post-tag-pill">{tone}</span>
                            ))}
                          </div>
                        )}
                        {message.styleProfile.commonTags?.length > 0 && (
                          <div className="agent-chatbox-pill-row">
                            {message.styleProfile.commonTags.slice(0, 4).map((tag) => (
                              <span key={`tag-${tag}`} className="post-tag-pill">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {message.referencePosts?.length > 0 && (
                      <div className="agent-chatbox-card-grid">
                        {message.referencePosts.map((post) => (
                          <Link key={`ref-${post.id}`} to={`/forum/post/${post.id}`} className="agent-chatbox-card">
                            <strong>{post.title}</strong>
                            <span>{post.authorName}</span>
                            <span>{getSectionLabel(post.section)}</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {message.workspacePosts?.length > 0 && (
                      <div className="agent-chatbox-card-grid">
                        {message.workspacePosts.map((post) => (
                          <Link key={`workspace-${post.id}`} to={post.to} className="agent-chatbox-card">
                            <strong>{post.title}</strong>
                            <span>{getSectionLabel(post.section)}</span>
                            <span>Open AI Rewrite</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {message.actions?.length > 0 && (
                      <div className="forum-actions">
                        {message.actions.map((action) => (
                          <Link key={`${message.id}-${action.to}-${action.label}`} to={action.to} className="forum-secondary-btn text-decoration-none">
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    )}

                    {message.forumMatches?.length > 0 && (
                      <div className="agent-chatbox-card-grid">
                        {message.forumMatches.map((forum) => (
                          <button
                            key={`forum-match-${forum.id}`}
                            type="button"
                            className="agent-chatbox-card text-start"
                            onClick={() => currentUser ? openDraftInComposerForForum(message.draft, forum) : navigate('/login')}
                          >
                            <strong>{forum.name}</strong>
                            <span>{forum.isFollowing ? 'Following' : 'Space'}</span>
                            <span>{getSectionLabel(forum.suggestedSection || forum.sectionScope?.[0] || '')}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {message.draft && (
                      <div className="agent-chatbox-draft">
                        <strong>{message.draft.title}</strong>
                        <span>{getSectionLabel(message.draft.section)}</span>
                        {message.draft.tags?.length > 0 && <span>#{message.draft.tags.join(' #')}</span>}
                        {message.generation && (
                          <span>
                            {message.generation.provider === 'openai'
                              ? `Generated with ${message.generation.model || 'OpenAI'}${message.generation.fallback ? ' (fallback used)' : ''}`
                              : 'Generated with local template mode'}
                          </span>
                        )}
                        <pre>{message.draft.content}</pre>
                        <div className="forum-actions">
                          <button type="button" className="forum-secondary-btn" onClick={() => setInput(`find posts about ${message.draft.title}`)}>
                            Search Similar
                          </button>
                          {currentUser ? (
                            <>
                              {message.forumMatches?.length > 1 ? null : (
                                <>
                                  <button type="button" className="forum-secondary-btn" onClick={() => openDraftInComposer(message.draft)}>
                                    Edit in Composer
                                  </button>
                                  <button type="button" className="forum-primary-btn" onClick={() => publishDraft(message.draft)}>
                                    Publish Draft
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <Link to="/login" className="forum-primary-btn text-decoration-none">
                              Login to Publish
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {message.forumRequestDraft && (
                      <div className="agent-chatbox-draft">
                        <div className="agent-chatbox-field-block">
                          <span className="agent-chatbox-field-label">Title</span>
                          <strong>{message.forumRequestDraft.name}</strong>
                        </div>
                        {message.forumRequestDraft.overview && (
                          <div className="agent-chatbox-field-block">
                            <span className="agent-chatbox-field-label">Overview</span>
                            <p className="mb-0">{message.forumRequestDraft.overview}</p>
                          </div>
                        )}
                        {message.forumRequestDraft.sectionScope?.length > 0 && (
                          <div className="agent-chatbox-field-block">
                            <span className="agent-chatbox-field-label">Scope</span>
                            <span>{message.forumRequestDraft.sectionScope.map(getSectionLabel).join(' · ')}</span>
                          </div>
                        )}
                        {message.generation && (
                          <span>
                            {message.generation.provider === 'openai'
                              ? `Generated with ${message.generation.model || 'OpenAI'}${message.generation.fallback ? ' (fallback used)' : ''}`
                              : 'Generated with local template mode'}
                          </span>
                        )}
                        <div className="agent-chatbox-field-block">
                          <span className="agent-chatbox-field-label">Description</span>
                          <p className="mb-0">{message.forumRequestDraft.description}</p>
                        </div>
                        <div className="agent-chatbox-field-block">
                          <span className="agent-chatbox-field-label">Why This Space Should Exist</span>
                          <p className="mb-0">{message.forumRequestDraft.rationale}</p>
                        </div>
                        <div className="forum-actions">
                          {currentUser ? (
                            <button type="button" className="forum-primary-btn" onClick={() => openForumRequestDraft(message.forumRequestDraft)}>
                              Open Request Form
                            </button>
                          ) : (
                            <Link to="/login" className="forum-primary-btn text-decoration-none">
                              Login to Request
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {loading && (
              <div className="agent-chatbox-message is-agent is-thinking">
                <div className="agent-chatbox-message-label">Assistant</div>
                <div className="agent-chatbox-thinking-row">
                  <span className="agent-chatbox-thinking-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <p className="muted mb-0">Agent is thinking...</p>
                </div>
              </div>
            )}
          </div>

          <form
            className="agent-chatbox-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
          >
            <textarea
              ref={inputRef}
              className="form-control forum-input"
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={currentUser
                ? 'Try "show me the latest announcements", "take me to my posts", or "draft a post in my style about postgres indexing".'
                : 'Try "show me the latest announcements", "find posts about analytics", or "draft a space request for an MLOps community".'}
            />
            <div className="forum-actions">
              <span className="muted">
                {editingMessageId ? 'Editing a previous message. Enter to resend, Shift+Enter for a new line.' : 'Enter to send, Shift+Enter for a new line.'}
              </span>
              {editingMessageId && (
                <button type="button" className="forum-secondary-btn" onClick={cancelEditingMessage} disabled={loading}>
                  Cancel Edit
                </button>
              )}
              {loading && (
                <button type="button" className="forum-secondary-btn" onClick={stopThinking}>
                  Stop
                </button>
              )}
              <button type="submit" className="forum-primary-btn" disabled={loading}>
                {editingMessageId ? 'Resend' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      )}

      <button type="button" className="agent-chatbox-trigger" onClick={() => setIsOpen((current) => !current)}>
        <span className="agent-chatbox-trigger-badge" aria-hidden="true">AI</span>
        <span className="agent-chatbox-trigger-copy">
          <span className="agent-chatbox-trigger-label">Agent</span>
          <span className="agent-chatbox-trigger-title">Open Assistant</span>
        </span>
      </button>
    </div>
  );
}
