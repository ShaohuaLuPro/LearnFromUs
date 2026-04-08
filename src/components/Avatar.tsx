import { useEffect, useMemo, useState } from 'react';

type AvatarProps = {
  imageUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
};

function getTokenChars(value: string) {
  return Array.from(String(value || '').trim()).filter((char) => char.trim().length > 0);
}

function getTokenAlphanumericChars(value: string) {
  return getTokenChars(value).filter((char) => /[A-Za-z0-9]/.test(char));
}

function getAvatarInitials(name: string) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return 'U';
  }

  const tokens = trimmedName.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return 'U';
  }

  if (tokens.length === 1) {
    const alphanumericChars = getTokenAlphanumericChars(tokens[0]);
    const baseChars = alphanumericChars.length > 0 ? alphanumericChars : getTokenChars(tokens[0]);
    return (baseChars.slice(0, 2).join('') || 'U').toUpperCase();
  }

  const firstTokenChars = getTokenAlphanumericChars(tokens[0]);
  const lastTokenChars = getTokenAlphanumericChars(tokens[tokens.length - 1]);
  const firstChar = firstTokenChars[0] || getTokenChars(tokens[0])[0] || '';
  const lastChar = lastTokenChars[0] || getTokenChars(tokens[tokens.length - 1])[0] || '';
  const initials = `${firstChar}${lastChar}`.trim().toUpperCase();
  return initials || 'U';
}

export default function Avatar({
  imageUrl,
  name,
  size = 32,
  className = ''
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedImageUrl = String(imageUrl || '').trim();
  const resolvedName = String(name || '').trim();
  const initials = useMemo(() => getAvatarInitials(resolvedName), [resolvedName]);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedImageUrl]);

  const avatarClassName = ['platform-avatar', className].filter(Boolean).join(' ');
  const avatarStyle = {
    width: `${size}px`,
    height: `${size}px`
  };

  if (resolvedImageUrl && !imageFailed) {
    return (
      <span className={avatarClassName} style={avatarStyle} aria-hidden="true">
        <img
          src={resolvedImageUrl}
          alt=""
          className="platform-avatar-image"
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className={`${avatarClassName} is-fallback`.trim()} style={avatarStyle} aria-hidden="true">
      <span className="platform-avatar-fallback">{initials}</span>
    </span>
  );
}
