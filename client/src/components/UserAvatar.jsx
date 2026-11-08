import React from 'react';

export default function UserAvatar({ src, name = '', className = '', fallbackLength = 1, title }) {
  const fallback = name.trim().slice(0, fallbackLength) || '؟';

  return (
    <span className={`user-avatar ${className}`.trim()} title={title || name} aria-label={name || 'المستخدم'}>
      {src ? <img src={src} alt="" /> : fallback}
    </span>
  );
}
