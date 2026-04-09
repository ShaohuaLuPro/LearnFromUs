import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiUploadMediaFile, buildMediaToken, resolveMediaSource } from '../../api';
import { authStorage } from '../../lib/authStorage';

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/i;
const HTML_IMAGE_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;

function sanitizeAltText(input) {
  return String(input || 'cover image')
    .replace(/\.[^./\\]+$/, '')
    .replace(/[[\]<>]+/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'cover image';
}

function extractFirstImage(content) {
  const text = String(content || '');
  const markdownMatch = MARKDOWN_IMAGE_REGEX.exec(text);
  const htmlMatch = HTML_IMAGE_REGEX.exec(text);

  const markdownResult = markdownMatch
    ? {
        type: 'markdown',
        index: markdownMatch.index,
        raw: markdownMatch[0],
        source: String(markdownMatch[2] || '').replace(/^<|>$/g, '').trim(),
        alt: String(markdownMatch[1] || '').trim()
      }
    : null;

  const htmlResult = htmlMatch
    ? {
        type: 'html',
        index: htmlMatch.index,
        raw: htmlMatch[0],
        source: String(htmlMatch[1] || '').trim(),
        alt: ''
      }
    : null;

  if (!markdownResult && !htmlResult) {
    return null;
  }
  if (!markdownResult) {
    return htmlResult;
  }
  if (!htmlResult) {
    return markdownResult;
  }
  return markdownResult.index <= htmlResult.index ? markdownResult : htmlResult;
}

function buildCoverMarkdown(source, altText) {
  const safeAlt = sanitizeAltText(altText);
  return `![${safeAlt}](${source})`;
}

function insertOrReplaceCoverImage(content, source, altText) {
  const text = String(content || '');
  const imageMarkdown = buildCoverMarkdown(source, altText);
  const existingImage = extractFirstImage(text);

  if (existingImage) {
    const start = existingImage.index;
    const end = start + existingImage.raw.length;
    return `${text.slice(0, start)}${imageMarkdown}${text.slice(end)}`;
  }

  const trimmed = text.trimStart();
  if (!trimmed) {
    return `${imageMarkdown}\n`;
  }
  return `${imageMarkdown}\n\n${trimmed}`;
}

function removeFirstImage(content) {
  const text = String(content || '');
  const existingImage = extractFirstImage(text);
  if (!existingImage) {
    return text;
  }

  const start = existingImage.index;
  const end = start + existingImage.raw.length;
  const before = text.slice(0, start).replace(/[ \t]+$/g, '');
  const after = text.slice(end).replace(/^\s*\n?/g, '');

  if (!before.trim()) {
    return after.trimStart();
  }
  if (!after.trim()) {
    return before.trimEnd();
  }
  return `${before.trimEnd()}\n\n${after.trimStart()}`;
}

export default function CoverImageUploader({
  content,
  onContentChange,
  onTransformContent,
  onAssetUploaded,
  onUploadingChange,
  onError,
  disabled = false,
  className = ''
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const currentImage = useMemo(() => extractFirstImage(content), [content]);
  const previewSource = useMemo(
    () => resolveMediaSource(currentImage?.source || ''),
    [currentImage?.source]
  );

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

  const resetMessages = () => {
    setNotice('');
    setErrorMessage('');
  };

  const setError = (message) => {
    const cleanMessage = String(message || 'Failed to upload image.');
    setErrorMessage(cleanMessage);
    setNotice('');
    onError?.(cleanMessage);
  };

  const openFilePicker = () => {
    if (disabled || uploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  const applyContentChange = (transformer) => {
    if (typeof onTransformContent === 'function') {
      onTransformContent(transformer);
      return;
    }

    if (typeof onContentChange === 'function') {
      onContentChange(transformer(String(content || '')));
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) {
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    if (!ACCEPTED_IMAGE_MIME_TYPES.has(String(file.type || '').toLowerCase())) {
      setError('Supported formats: JPG, PNG, WEBP, GIF, AVIF.');
      return;
    }

    if (Number(file.size || 0) > MAX_IMAGE_UPLOAD_BYTES) {
      setError('Image must be 10MB or smaller.');
      return;
    }

    const token = authStorage.getToken();
    if (!token) {
      setError('Login expired. Please sign in again before uploading.');
      return;
    }

    setUploading(true);
    resetMessages();

    try {
      const asset = await apiUploadMediaFile(file, token);
      const mediaToken = buildMediaToken(asset.id);
      applyContentChange((currentContent) => insertOrReplaceCoverImage(currentContent, mediaToken, file.name));
      onAssetUploaded?.({
        id: asset.id,
        token: mediaToken,
        source: mediaToken,
        storageUrl: asset.url
      });
      setNotice('Cover image uploaded.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to upload image.');
    } finally {
      setUploading(false);
      setIsDragging(false);
    }
  };

  const handleInputChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    await handleFileUpload(file);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || uploading) {
      return;
    }
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    await handleFileUpload(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsDragging(false);
  };

  const handleRemoveImage = () => {
    resetMessages();
    applyContentChange((currentContent) => removeFirstImage(currentContent));
    setNotice('Cover image removed.');
  };

  return (
    <section className={`cover-image-uploader ${className}`.trim()} aria-label="Cover image uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="d-none"
        onChange={handleInputChange}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`cover-image-dropzone ${isDragging ? 'is-dragging' : ''} ${uploading ? 'is-uploading' : ''}`.trim()}
        aria-disabled={disabled || uploading}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {previewSource ? (
          <img src={previewSource} alt={currentImage?.alt || 'Post cover'} className="cover-image-preview" loading="lazy" />
        ) : (
          <div className="cover-image-empty-state">
            <strong>Drop a cover image here</strong>
            <span>or click to upload</span>
          </div>
        )}

        <div className="cover-image-overlay">
          <span>{uploading ? 'Uploading cover image...' : (previewSource ? 'Replace cover image' : 'Drag & drop or click to upload')}</span>
        </div>
      </div>

      <div className="cover-image-actions">
        <button
          type="button"
          className="forum-secondary-btn"
          disabled={disabled || uploading}
          onClick={openFilePicker}
        >
          {previewSource ? 'Replace' : 'Upload'}
        </button>
        {previewSource && (
          <button
            type="button"
            className="forum-secondary-btn"
            disabled={disabled || uploading}
            onClick={handleRemoveImage}
          >
            Remove
          </button>
        )}
      </div>

      {uploading && (
        <div className="cover-image-progress" role="status" aria-live="polite">
          <span className="cover-image-progress-bar" />
        </div>
      )}

      {notice && <p className="cover-image-feedback">{notice}</p>}
      {errorMessage && <p className="cover-image-feedback is-error">{errorMessage}</p>}
    </section>
  );
}
