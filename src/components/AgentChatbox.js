import React, { useEffect, useRef, useState } from 'react';
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
  const starterPrompts = currentUser
      ? [
        'take me to the about page',
        'i want to change my password',
        'draft a post in my style about password reset',
        'draft a forum request for an mlops community',
        'i want to learn mle',
        'help me improve my post about analytics',
        'draft a post in my style about postgres indexing',
        'find posts about analytics',
        'show top authors'
      ]
    : [
        'take me to the about page',
        'i want to learn mle',
        'help me improve my post about analytics',
        'find posts about mongodb',
        'show top authors',
        'draft a post about password reset',
        'find posts about analytics'
      ];
  const buildWelcomeMessage = () => ({
    id: 'welcome',
    role: 'agent',
    reply: currentUser
      ? 'Ask me to navigate the site, recommend posts to learn a topic, surface active authors, draft a post in your style, or draft a new forum request.'
      : 'Ask me to navigate the site, recommend posts to learn a topic, surface active authors, draft a post, or draft a new forum request.',
    quickActions: ['search-posts', 'show-trending', 'draft-post']
  });
  const [messages, setMessages] = useState([buildWelcomeMessage()]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.id !== 'welcome') {
        return current;
      }
      return [buildWelcomeMessage()];
    });
  }, [currentUser]);

  useEffect(() => {
    if (!isOpen || !threadRef.current) {
      return;
    }
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [isOpen, messages, loading]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  const fillInputFromPrompt = (prompt) => {
    setInput(String(prompt || ''));
    setEditingMessageId(null);
    inputRef.current?.focus();
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
          ? 'Draft published. I refreshed the forum state, and you can open it from My Posts or Forum.'
          : result.message
      }
    ]);
    if (result.ok) {
      navigate('/forum');
    }
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
            <div>
              <p className="type-kicker mb-1">Agent</p>
              <h3 className="mb-0">Forum Assistant</h3>
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
              <button key={prompt} type="button" className="section-chip" onClick={() => fillInputFromPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div ref={threadRef} className="agent-chatbox-thread">
            {messages.map((message) => (
              <div key={message.id} className={`agent-chatbox-message is-${message.role}`}>
                {message.role === 'user' ? (
                  <>
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
                              <button type="button" className="forum-secondary-btn" onClick={() => openDraftInComposer(message.draft)}>
                                Edit in Composer
                              </button>
                              <button type="button" className="forum-primary-btn" onClick={() => publishDraft(message.draft)}>
                                Publish Draft
                              </button>
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
                          <span className="agent-chatbox-field-label">Why This Forum Should Exist</span>
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

            {loading && <p className="muted mb-0">Agent is thinking...</p>}
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
                ? 'Try "take me to about", "draft a forum request for an MLOps community", or "help me improve my post".'
                : 'Try "take me to about", or ask to learn a topic, search posts, or draft a forum request.'}
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
        AI Agent
      </button>
    </div>
  );
}
