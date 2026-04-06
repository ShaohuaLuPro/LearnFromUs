import React, { useEffect, useMemo, useRef, useState } from 'react';

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

function getAuthorLabel(message, viewerRole) {
  if (message.authorRole === viewerRole) {
    return 'You';
  }

  return message.authorRole === 'admin' ? 'Admin' : 'Author';
}

export default function AppealConversation({
  messages,
  viewerRole = 'author',
  emptyLabel = 'No messages yet.',
  composerLabel,
  composerPlaceholder,
  composerValue,
  onComposerChange,
  onSubmit,
  submitLabel = 'Leave Message',
  submitDisabled = false,
  maxLength,
  helperText,
  collapsible = false,
  collapsedLines = 3
}) {
  const entries = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);
  const currentLength = String(composerValue || '').length;
  const [expandedMessages, setExpandedMessages] = useState({});
  const [overflowingMessages, setOverflowingMessages] = useState({});
  const messageRefs = useRef({});

  useEffect(() => {
    if (!collapsible) {
      setOverflowingMessages({});
      return undefined;
    }

    const measureMessages = () => {
      setOverflowingMessages((current) => {
        const next = {};

        entries.forEach((message) => {
          const node = messageRefs.current[message.id];
          if (!node) {
            next[message.id] = current[message.id] || false;
            return;
          }

          const isExpanded = Boolean(expandedMessages[message.id]);
          if (isExpanded) {
            next[message.id] = current[message.id] || true;
            return;
          }

          next[message.id] = node.scrollHeight > node.clientHeight + 1;
        });

        return next;
      });
    };

    measureMessages();
    window.addEventListener('resize', measureMessages);
    return () => window.removeEventListener('resize', measureMessages);
  }, [collapsedLines, collapsible, entries, expandedMessages]);

  return (
    <section className="appeal-thread">
      <div className="appeal-thread-list">
        {entries.length === 0 ? (
          <p className="muted mb-0">{emptyLabel}</p>
        ) : (
          entries.map((message) => {
            const isOwnMessage = message.authorRole === viewerRole;
            const isExpanded = Boolean(expandedMessages[message.id]);
            const expandable = collapsible && Boolean(overflowingMessages[message.id]);

            return (
              <article
                key={message.id}
                className={`appeal-thread-item ${isOwnMessage ? 'is-own' : 'is-other'} ${message.authorRole === 'admin' ? 'role-admin' : 'role-author'}`}
              >
                <div className="appeal-thread-meta">
                  <strong>{getAuthorLabel(message, viewerRole)}</strong>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <p
                  ref={(node) => {
                    if (node) {
                      messageRefs.current[message.id] = node;
                    } else {
                      delete messageRefs.current[message.id];
                    }
                  }}
                  className={`appeal-thread-bubble mb-0 ${collapsible && !isExpanded ? 'is-collapsed' : ''}`}
                  style={collapsible ? { WebkitLineClamp: collapsedLines } : undefined}
                >
                  {message.message}
                </p>
                {expandable && (
                  <button
                    type="button"
                    className="forum-inline-toggle"
                    onClick={() => setExpandedMessages((current) => ({
                      ...current,
                      [message.id]: !current[message.id]
                    }))}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>

      {typeof onSubmit === 'function' && typeof onComposerChange === 'function' && (
        <div className="appeal-thread-composer">
          {composerLabel && <label className="form-label">{composerLabel}</label>}
          <textarea
            className="form-control forum-input"
            rows={3}
            value={composerValue || ''}
            onChange={(event) => onComposerChange(event.target.value)}
            placeholder={composerPlaceholder || ''}
            maxLength={typeof maxLength === 'number' ? maxLength : undefined}
          />
          {(helperText || typeof maxLength === 'number') && (
            <div className="appeal-thread-helper">
              <span>{helperText || ''}</span>
              {typeof maxLength === 'number' && (
                <span>{currentLength}/{maxLength}</span>
              )}
            </div>
          )}
          <div className="forum-actions mt-2">
            <button
              type="button"
              className="forum-primary-btn"
              disabled={submitDisabled}
              onClick={onSubmit}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
